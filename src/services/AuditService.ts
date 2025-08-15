import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { EncryptionService } from './EncryptionService';

export interface AuditEvent {
  eventType: AuditEventType;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  timestamp?: Date;
  severity: AuditSeverity;
  complianceRelevant: boolean;
}

export enum AuditEventType {
  USER_ACTION = 'USER_ACTION',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
  SECURITY_EVENT = 'SECURITY_EVENT',
  COMPLIANCE_EVENT = 'COMPLIANCE_EVENT',
  BLOCKCHAIN_EVENT = 'BLOCKCHAIN_EVENT',
  FINANCIAL_EVENT = 'FINANCIAL_EVENT'
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export class AuditService {
  private static pool: Pool;

  static initialize(dbPool: Pool) {
    this.pool = dbPool;
    this.createAuditTable();
    logger.info('Audit service initialized');
  }

  private static async createAuditTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        user_id VARCHAR(255),
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        encrypted_details TEXT,
        ip_address INET,
        user_agent TEXT,
        request_id VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        severity VARCHAR(20) NOT NULL,
        compliance_relevant BOOLEAN DEFAULT FALSE,
        hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance ON audit_logs(compliance_relevant, timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity, timestamp);
    `;

    try {
      await this.pool.query(createTableQuery);
      logger.info('Audit table created/verified');
    } catch (error) {
      logger.error('Failed to create audit table', error);
      throw error;
    }
  }

  /**
   * Log an audit event
   */
  static async logEvent(event: AuditEvent): Promise<void> {
    try {
      const timestamp = event.timestamp || new Date();
      
      // Encrypt sensitive details
      const encryptedDetails = event.details ? 
        EncryptionService.encryptPII(event.details) : null;
      
      // Create hash for integrity verification
      const hashData = JSON.stringify({
        eventType: event.eventType,
        userId: event.userId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        timestamp: timestamp.toISOString()
      });
      const hash = EncryptionService.createSignature(hashData);

      const query = `
        INSERT INTO audit_logs (
          event_type, user_id, entity_type, entity_id, action,
          details, encrypted_details, ip_address, user_agent, request_id,
          timestamp, severity, compliance_relevant, hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

      const values = [
        event.eventType,
        event.userId,
        event.entityType,
        event.entityId,
        event.action,
        event.complianceRelevant ? null : event.details, // Store non-sensitive details in plain JSON
        encryptedDetails,
        event.ipAddress,
        event.userAgent,
        event.requestId,
        timestamp,
        event.severity,
        event.complianceRelevant,
        hash
      ];

      await this.pool.query(query, values);

      // Also log to application logger for immediate visibility
      logger.info('Audit event logged', {
        eventType: event.eventType,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        severity: event.severity,
        userId: event.userId,
        requestId: event.requestId
      });

    } catch (error) {
      logger.error('Failed to log audit event', error);
      // Don't throw error to avoid breaking the main application flow
    }
  }

  /**
   * Log user authentication events
   */
  static async logAuthEvent(
    action: string,
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string,
    details?: any
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.SECURITY_EVENT,
      userId,
      entityType: 'USER',
      entityId: userId,
      action: `AUTH_${action.toUpperCase()}`,
      details: {
        success,
        ...details
      },
      ipAddress,
      userAgent,
      requestId,
      severity: success ? AuditSeverity.LOW : AuditSeverity.HIGH,
      complianceRelevant: true
    });
  }

  /**
   * Log financial transactions
   */
  static async logFinancialEvent(
    action: string,
    userId: string,
    amount: number,
    currency: string,
    transactionId: string,
    details?: any,
    requestId?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.FINANCIAL_EVENT,
      userId,
      entityType: 'TRANSACTION',
      entityId: transactionId,
      action: action.toUpperCase(),
      details: {
        amount,
        currency,
        ...details
      },
      requestId,
      severity: amount > 10000 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      complianceRelevant: true
    });
  }

  /**
   * Log blockchain events
   */
  static async logBlockchainEvent(
    action: string,
    userId: string,
    blockchainTxId: string,
    tokenId?: string,
    details?: any,
    requestId?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.BLOCKCHAIN_EVENT,
      userId,
      entityType: 'BLOCKCHAIN_TX',
      entityId: blockchainTxId,
      action: action.toUpperCase(),
      details: {
        tokenId,
        ...details
      },
      requestId,
      severity: AuditSeverity.MEDIUM,
      complianceRelevant: true
    });
  }

  /**
   * Log KYC/compliance events
   */
  static async logComplianceEvent(
    action: string,
    userId: string,
    kycStatus?: string,
    details?: any,
    requestId?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.COMPLIANCE_EVENT,
      userId,
      entityType: 'KYC',
      entityId: userId,
      action: `KYC_${action.toUpperCase()}`,
      details: {
        kycStatus,
        ...details
      },
      requestId,
      severity: AuditSeverity.HIGH,
      complianceRelevant: true
    });
  }

  /**
   * Log security incidents
   */
  static async logSecurityIncident(
    action: string,
    severity: AuditSeverity,
    details: any,
    userId?: string,
    ipAddress?: string,
    requestId?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.SECURITY_EVENT,
      userId,
      entityType: 'SECURITY',
      entityId: requestId || 'UNKNOWN',
      action: `SECURITY_${action.toUpperCase()}`,
      details,
      ipAddress,
      severity,
      complianceRelevant: true,
      requestId
    });
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    eventTypes?: AuditEventType[]
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          event_type,
          user_id,
          entity_type,
          entity_id,
          action,
          details,
          ip_address,
          timestamp,
          severity
        FROM audit_logs
        WHERE compliance_relevant = true
          AND timestamp >= $1
          AND timestamp <= $2
      `;

      const values: any[] = [startDate, endDate];

      if (eventTypes && eventTypes.length > 0) {
        query += ` AND event_type = ANY($3)`;
        values.push(eventTypes);
      }

      query += ` ORDER BY timestamp DESC`;

      const result = await this.pool.query(query, values);
      return result.rows;

    } catch (error) {
      logger.error('Failed to generate compliance report', error);
      throw error;
    }
  }

  /**
   * Get audit trail for specific entity
   */
  static async getAuditTrail(
    entityType: string,
    entityId: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const query = `
        SELECT 
          event_type,
          user_id,
          action,
          details,
          timestamp,
          severity,
          request_id
        FROM audit_logs
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY timestamp DESC
        LIMIT $3
      `;

      const result = await this.pool.query(query, [entityType, entityId, limit]);
      return result.rows;

    } catch (error) {
      logger.error('Failed to get audit trail', error);
      throw error;
    }
  }

  /**
   * Verify audit log integrity
   */
  static async verifyLogIntegrity(logId: number): Promise<boolean> {
    try {
      const query = `
        SELECT event_type, user_id, entity_type, entity_id, action, timestamp, hash
        FROM audit_logs
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [logId]);
      if (result.rows.length === 0) {
        return false;
      }

      const log = result.rows[0];
      const hashData = JSON.stringify({
        eventType: log.event_type,
        userId: log.user_id,
        entityType: log.entity_type,
        entityId: log.entity_id,
        action: log.action,
        timestamp: log.timestamp
      });

      const expectedHash = EncryptionService.createSignature(hashData);
      return log.hash === expectedHash;

    } catch (error) {
      logger.error('Failed to verify log integrity', error);
      return false;
    }
  }

  /**
   * Archive old audit logs
   */
  static async archiveOldLogs(olderThanDays: number = 2555): Promise<number> { // 7 years default
    try {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - olderThanDays);

      // First, export to archive table
      const archiveQuery = `
        INSERT INTO audit_logs_archive 
        SELECT * FROM audit_logs 
        WHERE timestamp < $1
      `;

      await this.pool.query(archiveQuery, [archiveDate]);

      // Then delete from main table
      const deleteQuery = `
        DELETE FROM audit_logs 
        WHERE timestamp < $1
      `;

      const result = await this.pool.query(deleteQuery, [archiveDate]);
      
      logger.info(`Archived ${result.rowCount} audit logs older than ${olderThanDays} days`);
      return result.rowCount || 0;

    } catch (error) {
      logger.error('Failed to archive old logs', error);
      throw error;
    }
  }
}