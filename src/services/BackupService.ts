import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import AWS from 'aws-sdk';
import { logger } from '../utils/logger';
import { EncryptionService } from './EncryptionService';

const execAsync = promisify(exec);

export interface BackupConfig {
  schedule: string; // cron format
  retentionDays: number;
  encryptBackups: boolean;
  uploadToCloud: boolean;
  cloudProvider: 'aws' | 'gcp' | 'azure';
  notifyOnFailure: boolean;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  checksum: string;
  encrypted: boolean;
  location: string;
  status: 'completed' | 'failed' | 'in_progress';
}

export class BackupService {
  private static pool: Pool;
  private static s3: AWS.S3;
  private static config: BackupConfig;
  private static backupDir: string;

  static initialize(dbPool: Pool, config: BackupConfig) {
    this.pool = dbPool;
    this.config = config;
    this.backupDir = process.env.BACKUP_DIR || '/tmp/backups';
    
    // Initialize cloud storage if enabled
    if (config.uploadToCloud && config.cloudProvider === 'aws') {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
    }

    this.createBackupTable();
    this.ensureBackupDirectory();
    logger.info('Backup service initialized');
  }

  private static async createBackupTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS backup_metadata (
        id VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        type VARCHAR(20) NOT NULL,
        size BIGINT NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        encrypted BOOLEAN DEFAULT FALSE,
        location TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_backup_timestamp ON backup_metadata(timestamp);
      CREATE INDEX IF NOT EXISTS idx_backup_status ON backup_metadata(status);
    `;

    try {
      await this.pool.query(createTableQuery);
    } catch (error) {
      logger.error('Failed to create backup metadata table', error);
      throw error;
    }
  }

  private static async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create backup directory', error);
      throw error;
    }
  }

  /**
   * Perform full database backup
   */
  static async performFullBackup(): Promise<BackupMetadata> {
    const backupId = `full_${Date.now()}_${EncryptionService.generateSecureToken(8)}`;
    const timestamp = new Date();
    const filename = `${backupId}.sql`;
    const filepath = path.join(this.backupDir, filename);

    try {
      logger.info('Starting full database backup', { backupId });

      // Record backup start
      await this.recordBackupMetadata({
        id: backupId,
        timestamp,
        type: 'full',
        size: 0,
        checksum: '',
        encrypted: this.config.encryptBackups,
        location: filepath,
        status: 'in_progress'
      });

      // Create database dump
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      const dumpCommand = `pg_dump "${dbUrl}" > "${filepath}"`;
      await execAsync(dumpCommand);

      // Get file size and checksum
      const stats = await fs.stat(filepath);
      const fileContent = await fs.readFile(filepath);
      const checksum = EncryptionService.createSignature(fileContent.toString());

      let finalPath = filepath;
      let encrypted = false;

      // Encrypt backup if configured
      if (this.config.encryptBackups) {
        const encryptedContent = EncryptionService.encrypt(fileContent.toString());
        const encryptedPath = `${filepath}.enc`;
        await fs.writeFile(encryptedPath, encryptedContent);
        await fs.unlink(filepath); // Remove unencrypted file
        finalPath = encryptedPath;
        encrypted = true;
      }

      // Upload to cloud if configured
      if (this.config.uploadToCloud) {
        await this.uploadToCloud(finalPath, `backups/${filename}${encrypted ? '.enc' : ''}`);
      }

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: 'full',
        size: stats.size,
        checksum,
        encrypted,
        location: finalPath,
        status: 'completed'
      };

      await this.updateBackupMetadata(metadata);
      logger.info('Full database backup completed', { backupId, size: stats.size });

      return metadata;

    } catch (error) {
      logger.error('Full backup failed', { backupId, error });
      
      await this.updateBackupMetadata({
        id: backupId,
        timestamp,
        type: 'full',
        size: 0,
        checksum: '',
        encrypted: false,
        location: filepath,
        status: 'failed'
      });

      throw error;
    }
  }

  /**
   * Perform incremental backup (transaction log backup)
   */
  static async performIncrementalBackup(): Promise<BackupMetadata> {
    const backupId = `incremental_${Date.now()}_${EncryptionService.generateSecureToken(8)}`;
    const timestamp = new Date();
    const filename = `${backupId}.sql`;
    const filepath = path.join(this.backupDir, filename);

    try {
      logger.info('Starting incremental backup', { backupId });

      // Get last backup timestamp
      const lastBackupQuery = `
        SELECT timestamp FROM backup_metadata 
        WHERE status = 'completed' 
        ORDER BY timestamp DESC 
        LIMIT 1
      `;
      const lastBackupResult = await this.pool.query(lastBackupQuery);
      const lastBackupTime = lastBackupResult.rows[0]?.timestamp || new Date(0);

      // Record backup start
      await this.recordBackupMetadata({
        id: backupId,
        timestamp,
        type: 'incremental',
        size: 0,
        checksum: '',
        encrypted: this.config.encryptBackups,
        location: filepath,
        status: 'in_progress'
      });

      // Export changes since last backup
      const incrementalQuery = `
        COPY (
          SELECT 'audit_logs' as table_name, * FROM audit_logs 
          WHERE created_at > '${lastBackupTime.toISOString()}'
          UNION ALL
          SELECT 'users' as table_name, * FROM users 
          WHERE updated_at > '${lastBackupTime.toISOString()}'
          UNION ALL
          SELECT 'properties' as table_name, * FROM properties 
          WHERE updated_at > '${lastBackupTime.toISOString()}'
          UNION ALL
          SELECT 'investments' as table_name, * FROM investments 
          WHERE updated_at > '${lastBackupTime.toISOString()}'
          UNION ALL
          SELECT 'transactions' as table_name, * FROM transactions 
          WHERE updated_at > '${lastBackupTime.toISOString()}'
        ) TO '${filepath}' WITH CSV HEADER;
      `;

      await this.pool.query(incrementalQuery);

      // Process file similar to full backup
      const stats = await fs.stat(filepath);
      const fileContent = await fs.readFile(filepath);
      const checksum = EncryptionService.createSignature(fileContent.toString());

      let finalPath = filepath;
      let encrypted = false;

      if (this.config.encryptBackups) {
        const encryptedContent = EncryptionService.encrypt(fileContent.toString());
        const encryptedPath = `${filepath}.enc`;
        await fs.writeFile(encryptedPath, encryptedContent);
        await fs.unlink(filepath);
        finalPath = encryptedPath;
        encrypted = true;
      }

      if (this.config.uploadToCloud) {
        await this.uploadToCloud(finalPath, `backups/incremental/${filename}${encrypted ? '.enc' : ''}`);
      }

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: 'incremental',
        size: stats.size,
        checksum,
        encrypted,
        location: finalPath,
        status: 'completed'
      };

      await this.updateBackupMetadata(metadata);
      logger.info('Incremental backup completed', { backupId, size: stats.size });

      return metadata;

    } catch (error) {
      logger.error('Incremental backup failed', { backupId, error });
      
      await this.updateBackupMetadata({
        id: backupId,
        timestamp,
        type: 'incremental',
        size: 0,
        checksum: '',
        encrypted: false,
        location: filepath,
        status: 'failed'
      });

      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  static async restoreFromBackup(backupId: string): Promise<void> {
    try {
      logger.info('Starting database restore', { backupId });

      // Get backup metadata
      const metadataQuery = `
        SELECT * FROM backup_metadata WHERE id = $1 AND status = 'completed'
      `;
      const result = await this.pool.query(metadataQuery, [backupId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Backup ${backupId} not found or not completed`);
      }

      const metadata = result.rows[0];
      let backupPath = metadata.location;

      // Download from cloud if necessary
      if (this.config.uploadToCloud && !await this.fileExists(backupPath)) {
        backupPath = await this.downloadFromCloud(backupId);
      }

      // Decrypt if necessary
      if (metadata.encrypted) {
        const encryptedContent = await fs.readFile(backupPath, 'utf8');
        const decryptedContent = EncryptionService.decrypt(encryptedContent);
        const tempPath = `${backupPath}.temp`;
        await fs.writeFile(tempPath, decryptedContent);
        backupPath = tempPath;
      }

      // Verify checksum
      const fileContent = await fs.readFile(backupPath, 'utf8');
      const checksum = EncryptionService.createSignature(fileContent);
      
      if (checksum !== metadata.checksum) {
        throw new Error('Backup file integrity check failed');
      }

      // Perform restore
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      if (metadata.type === 'full') {
        // Full restore - drop and recreate database
        const restoreCommand = `psql "${dbUrl}" < "${backupPath}"`;
        await execAsync(restoreCommand);
      } else {
        // Incremental restore - apply changes
        const restoreCommand = `psql "${dbUrl}" -c "\\copy temp_restore FROM '${backupPath}' WITH CSV HEADER"`;
        await execAsync(restoreCommand);
        // Additional logic to apply incremental changes would go here
      }

      logger.info('Database restore completed', { backupId });

    } catch (error) {
      logger.error('Database restore failed', { backupId, error });
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  static async cleanupOldBackups(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      // Get old backups
      const oldBackupsQuery = `
        SELECT id, location FROM backup_metadata 
        WHERE timestamp < $1 AND status = 'completed'
      `;
      const result = await this.pool.query(oldBackupsQuery, [cutoffDate]);

      for (const backup of result.rows) {
        try {
          // Delete local file
          if (await this.fileExists(backup.location)) {
            await fs.unlink(backup.location);
          }

          // Delete from cloud if applicable
          if (this.config.uploadToCloud) {
            await this.deleteFromCloud(backup.id);
          }

          // Remove metadata
          await this.pool.query('DELETE FROM backup_metadata WHERE id = $1', [backup.id]);
          
          logger.info('Deleted old backup', { backupId: backup.id });
        } catch (error) {
          logger.error('Failed to delete old backup', { backupId: backup.id, error });
        }
      }

    } catch (error) {
      logger.error('Backup cleanup failed', error);
      throw error;
    }
  }

  /**
   * Test backup integrity
   */
  static async testBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const metadataQuery = `
        SELECT * FROM backup_metadata WHERE id = $1
      `;
      const result = await this.pool.query(metadataQuery, [backupId]);
      
      if (result.rows.length === 0) {
        return false;
      }

      const metadata = result.rows[0];
      let backupPath = metadata.location;

      // Download from cloud if necessary
      if (this.config.uploadToCloud && !await this.fileExists(backupPath)) {
        backupPath = await this.downloadFromCloud(backupId);
      }

      // Check file exists
      if (!await this.fileExists(backupPath)) {
        return false;
      }

      // Decrypt if necessary
      if (metadata.encrypted) {
        const encryptedContent = await fs.readFile(backupPath, 'utf8');
        const decryptedContent = EncryptionService.decrypt(encryptedContent);
        const tempPath = `${backupPath}.temp`;
        await fs.writeFile(tempPath, decryptedContent);
        backupPath = tempPath;
      }

      // Verify checksum
      const fileContent = await fs.readFile(backupPath, 'utf8');
      const checksum = EncryptionService.createSignature(fileContent);
      
      return checksum === metadata.checksum;

    } catch (error) {
      logger.error('Backup integrity test failed', { backupId, error });
      return false;
    }
  }

  // Private helper methods
  private static async recordBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const query = `
      INSERT INTO backup_metadata (id, timestamp, type, size, checksum, encrypted, location, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await this.pool.query(query, [
      metadata.id,
      metadata.timestamp,
      metadata.type,
      metadata.size,
      metadata.checksum,
      metadata.encrypted,
      metadata.location,
      metadata.status
    ]);
  }

  private static async updateBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const query = `
      UPDATE backup_metadata 
      SET size = $2, checksum = $3, encrypted = $4, location = $5, status = $6
      WHERE id = $1
    `;
    
    await this.pool.query(query, [
      metadata.id,
      metadata.size,
      metadata.checksum,
      metadata.encrypted,
      metadata.location,
      metadata.status
    ]);
  }

  private static async uploadToCloud(localPath: string, cloudPath: string): Promise<void> {
    if (this.config.cloudProvider === 'aws' && this.s3) {
      const fileContent = await fs.readFile(localPath);
      
      await this.s3.upload({
        Bucket: process.env.AWS_BACKUP_BUCKET || 'globalland-backups',
        Key: cloudPath,
        Body: fileContent,
        ServerSideEncryption: 'AES256'
      }).promise();
    }
  }

  private static async downloadFromCloud(backupId: string): Promise<string> {
    if (this.config.cloudProvider === 'aws' && this.s3) {
      const cloudPath = `backups/${backupId}.sql.enc`;
      const localPath = path.join(this.backupDir, `${backupId}_downloaded.sql.enc`);
      
      const result = await this.s3.getObject({
        Bucket: process.env.AWS_BACKUP_BUCKET || 'globalland-backups',
        Key: cloudPath
      }).promise();
      
      if (result.Body) {
        await fs.writeFile(localPath, result.Body as Buffer);
        return localPath;
      }
    }
    
    throw new Error('Failed to download backup from cloud');
  }

  private static async deleteFromCloud(backupId: string): Promise<void> {
    if (this.config.cloudProvider === 'aws' && this.s3) {
      const cloudPath = `backups/${backupId}.sql.enc`;
      
      await this.s3.deleteObject({
        Bucket: process.env.AWS_BACKUP_BUCKET || 'globalland-backups',
        Key: cloudPath
      }).promise();
    }
  }

  private static async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}