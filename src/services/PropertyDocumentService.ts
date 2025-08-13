import { PropertyDocument } from '../types/entities';
import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface DocumentUploadRequest {
  propertyId: string;
  documentType: string;
  documentName: string;
  file: Buffer;
  mimeType: string;
  uploadedBy?: string;
}

export interface IPFSUploadResult {
  success: boolean;
  hash?: string;
  url?: string;
  error?: string;
}

export class PropertyDocumentService extends BaseModel {
  private ipfsGateway: string;
  private localStoragePath: string;

  constructor() {
    super('property_documents');
    this.ipfsGateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
    this.localStoragePath = process.env.DOCUMENT_STORAGE_PATH || './uploads/documents';
    
    // Ensure local storage directory exists
    this.ensureStorageDirectory();
  }

  /**
   * Upload document to IPFS and store metadata
   */
  async uploadDocument(request: DocumentUploadRequest): Promise<{
    success: boolean;
    document?: PropertyDocument;
    error?: string;
  }> {
    try {
      logger.info(`Uploading document for property ${request.propertyId}: ${request.documentName}`);

      // Validate document
      const validation = this.validateDocument(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Upload to IPFS (or local storage as fallback)
      const uploadResult = await this.uploadToIPFS(request.file, request.mimeType);
      
      if (!uploadResult.success) {
        // Fallback to local storage
        const localResult = await this.uploadToLocalStorage(request.file, request.documentName, request.mimeType);
        if (!localResult.success) {
          return {
            success: false,
            error: 'Failed to upload document to both IPFS and local storage'
          };
        }
        uploadResult.hash = localResult.hash;
        uploadResult.url = localResult.url;
      }

      // Store document metadata in database
      const documentData = {
        property_id: request.propertyId,
        document_type: request.documentType,
        document_name: request.documentName,
        file_url: uploadResult.url || uploadResult.hash,
        file_size: request.file.length,
        mime_type: request.mimeType,
        uploaded_by: request.uploadedBy,
        verification_status: 'pending',
        ipfs_hash: uploadResult.hash
      };

      const document = await this.create<any>(documentData);
      const mappedDocument = this.mapDatabaseDocument(document);

      logger.info(`Document uploaded successfully: ${mappedDocument.id}`);

      return {
        success: true,
        document: mappedDocument
      };

    } catch (error) {
      logger.error('Failed to upload document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get documents for a property
   */
  async getPropertyDocuments(propertyId: string): Promise<PropertyDocument[]> {
    try {
      const query = 'SELECT * FROM property_documents WHERE property_id = $1 ORDER BY created_at DESC';
      const result = await this.query<any>(query, [propertyId]);
      return result.rows.map(row => this.mapDatabaseDocument(row));
    } catch (error) {
      logger.error(`Failed to get documents for property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: string): Promise<PropertyDocument | null> {
    try {
      const document = await this.findById(documentId);
      return document ? this.mapDatabaseDocument(document) : null;
    } catch (error) {
      logger.error(`Failed to get document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Update document verification status
   */
  async updateVerificationStatus(
    documentId: string, 
    status: string, 
    verifiedBy?: string, 
    notes?: string
  ): Promise<PropertyDocument | null> {
    try {
      const updateData: any = {
        verification_status: status,
        verified_at: new Date(),
        updated_at: new Date()
      };

      if (verifiedBy) {
        updateData.verified_by = verifiedBy;
      }

      if (notes) {
        updateData.verification_notes = notes;
      }

      const result = await this.updateById(documentId, updateData);
      return result ? this.mapDatabaseDocument(result) : null;
    } catch (error) {
      logger.error(`Failed to update verification status for document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const document = await this.getDocumentById(documentId);
      if (!document) {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      // Delete from database
      await this.deleteById(documentId);

      // Attempt to delete from storage (IPFS deletion is not always possible)
      if (document.fileUrl.startsWith('file://')) {
        await this.deleteFromLocalStorage(document.fileUrl);
      }

      logger.info(`Document deleted: ${documentId}`);

      return {
        success: true
      };

    } catch (error) {
      logger.error(`Failed to delete document ${documentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get document download URL
   */
  async getDocumentDownloadUrl(documentId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const document = await this.getDocumentById(documentId);
      if (!document) {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      // If it's an IPFS hash, construct the gateway URL
      if (document.fileUrl.startsWith('Qm') || document.fileUrl.startsWith('bafy')) {
        return {
          success: true,
          url: `${this.ipfsGateway}${document.fileUrl}`
        };
      }

      // If it's a local file URL, return as is
      if (document.fileUrl.startsWith('file://') || document.fileUrl.startsWith('http')) {
        return {
          success: true,
          url: document.fileUrl
        };
      }

      return {
        success: false,
        error: 'Invalid document URL format'
      };

    } catch (error) {
      logger.error(`Failed to get download URL for document ${documentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate document upload request
   */
  private validateDocument(request: DocumentUploadRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.propertyId) {
      errors.push('Property ID is required');
    }

    if (!request.documentType) {
      errors.push('Document type is required');
    }

    if (!request.documentName || request.documentName.trim().length === 0) {
      errors.push('Document name is required');
    }

    if (!request.file || request.file.length === 0) {
      errors.push('File content is required');
    }

    if (!request.mimeType) {
      errors.push('MIME type is required');
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (request.file && request.file.length > maxSize) {
      errors.push('File size exceeds maximum limit of 50MB');
    }

    // Check allowed document types
    const allowedTypes = ['deed', 'valuation', 'inspection', 'legal', 'financial', 'insurance', 'tax', 'other'];
    if (request.documentType && !allowedTypes.includes(request.documentType)) {
      errors.push(`Document type must be one of: ${allowedTypes.join(', ')}`);
    }

    // Check allowed MIME types
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (request.mimeType && !allowedMimeTypes.includes(request.mimeType)) {
      errors.push('File type not supported');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Upload file to IPFS
   */
  private async uploadToIPFS(file: Buffer, mimeType: string): Promise<IPFSUploadResult> {
    try {
      // In a real implementation, you would use an IPFS client like ipfs-http-client
      // For now, we'll simulate IPFS upload or use a service like Pinata
      
      // Simulate IPFS upload with a hash
      const hash = this.generateIPFSHash(file);
      
      // In production, you would:
      // 1. Use ipfs-http-client to upload to local IPFS node
      // 2. Or use a service like Pinata, Infura IPFS, or Web3.Storage
      // 3. Pin the content to ensure persistence
      
      logger.info(`Simulated IPFS upload with hash: ${hash}`);
      
      return {
        success: true,
        hash,
        url: `${this.ipfsGateway}${hash}`
      };

    } catch (error) {
      logger.error('IPFS upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'IPFS upload failed'
      };
    }
  }

  /**
   * Upload file to local storage as fallback
   */
  private async uploadToLocalStorage(file: Buffer, fileName: string, mimeType: string): Promise<IPFSUploadResult> {
    try {
      const fileExtension = this.getFileExtension(mimeType);
      const uniqueFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExtension}`;
      const filePath = path.join(this.localStoragePath, uniqueFileName);

      await fs.promises.writeFile(filePath, file);

      const fileUrl = `file://${filePath}`;
      const hash = crypto.createHash('sha256').update(file).digest('hex');

      logger.info(`File uploaded to local storage: ${filePath}`);

      return {
        success: true,
        hash,
        url: fileUrl
      };

    } catch (error) {
      logger.error('Local storage upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Local storage upload failed'
      };
    }
  }

  /**
   * Delete file from local storage
   */
  private async deleteFromLocalStorage(fileUrl: string): Promise<void> {
    try {
      if (fileUrl.startsWith('file://')) {
        const filePath = fileUrl.replace('file://', '');
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          logger.info(`File deleted from local storage: ${filePath}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to delete file from local storage:', error);
    }
  }

  /**
   * Generate simulated IPFS hash
   */
  private generateIPFSHash(file: Buffer): string {
    // Generate a hash that looks like an IPFS hash
    const hash = crypto.createHash('sha256').update(file).digest('hex');
    return `Qm${hash.substring(0, 44)}`;
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
    };

    return extensions[mimeType] || '.bin';
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDirectory(): void {
    try {
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
        logger.info(`Created storage directory: ${this.localStoragePath}`);
      }
    } catch (error) {
      logger.error('Failed to create storage directory:', error);
    }
  }

  /**
   * Map database row to PropertyDocument entity
   */
  private mapDatabaseDocument(row: any): PropertyDocument {
    return {
      id: row.id,
      propertyId: row.property_id,
      documentType: row.document_type,
      documentName: row.document_name,
      fileUrl: row.file_url,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadedBy: row.uploaded_by,
      verificationStatus: row.verification_status,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at,
      createdAt: row.created_at
    };
  }
}