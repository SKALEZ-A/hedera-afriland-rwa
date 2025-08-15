import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_ROUNDS = 12;

  private static encryptionKey: Buffer;

  static initialize() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Derive key from environment variable
    this.encryptionKey = crypto.scryptSync(key, 'salt', this.KEY_LENGTH);
    logger.info('Encryption service initialized');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  static encrypt(plaintext: string): string {
    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipher(this.ALGORITHM, this.encryptionKey, iv);
      cipher.setAAD(Buffer.from('GlobalLand-RWA', 'utf8'));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const result = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  static decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipher(this.ALGORITHM, this.encryptionKey, iv);
      decipher.setAAD(Buffer.from('GlobalLand-RWA', 'utf8'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash passwords using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      logger.error('Password hashing failed', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification failed', error);
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key
   */
  static generateApiKey(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    return `gla_${timestamp}_${random}`;
  }

  /**
   * Hash sensitive data for storage (one-way)
   */
  static hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypt PII data with additional metadata
   */
  static encryptPII(data: any): string {
    const payload = {
      data,
      timestamp: Date.now(),
      version: '1.0'
    };
    return this.encrypt(JSON.stringify(payload));
  }

  /**
   * Decrypt PII data and validate metadata
   */
  static decryptPII(encryptedData: string): any {
    const decrypted = this.decrypt(encryptedData);
    const payload = JSON.parse(decrypted);
    
    // Validate payload structure
    if (!payload.data || !payload.timestamp || !payload.version) {
      throw new Error('Invalid PII data structure');
    }
    
    return payload.data;
  }

  /**
   * Create HMAC signature for data integrity
   */
  static createSignature(data: string, secret?: string): string {
    const key = secret || process.env.HMAC_SECRET || 'default-secret';
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifySignature(data: string, signature: string, secret?: string): boolean {
    const expectedSignature = this.createSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt database connection strings
   */
  static encryptConnectionString(connectionString: string): string {
    return this.encrypt(connectionString);
  }

  /**
   * Decrypt database connection strings
   */
  static decryptConnectionString(encryptedConnectionString: string): string {
    return this.decrypt(encryptedConnectionString);
  }

  /**
   * Generate encryption key for new tenant/property
   */
  static generatePropertyKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt property-specific sensitive data
   */
  static encryptPropertyData(data: any, propertyKey: string): string {
    const key = crypto.scryptSync(propertyKey, 'property-salt', this.KEY_LENGTH);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipher(this.ALGORITHM, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt property-specific sensitive data
   */
  static decryptPropertyData(encryptedData: string, propertyKey: string): any {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid property data format');
    }

    const key = crypto.scryptSync(propertyKey, 'property-salt', this.KEY_LENGTH);
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(this.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}

// Initialize encryption service on module load
EncryptionService.initialize();