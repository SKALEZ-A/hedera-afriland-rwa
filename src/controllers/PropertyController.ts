import { Request, Response } from 'express';
import { PropertyService, PropertyRegistrationRequest, PropertySearchFilters, PropertyValuationUpdate } from '../services/PropertyService';
import { PropertyDocumentService, DocumentUploadRequest } from '../services/PropertyDocumentService';
import { logger } from '../utils/logger';
import multer from 'multer';
import { PropertyStatus, PropertyType } from '../types/entities';

// Configure multer for file uploads
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow specific file types
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

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  }
});

export class PropertyController {
  private propertyService: PropertyService;
  private documentService: PropertyDocumentService;

  constructor() {
    this.propertyService = new PropertyService();
    this.documentService = new PropertyDocumentService();
  }

  /**
   * Register a new property
   */
  registerProperty = async (req: Request, res: Response): Promise<void> => {
    try {
      const registrationRequest: PropertyRegistrationRequest = {
        name: req.body.name,
        description: req.body.description,
        propertyType: req.body.propertyType as PropertyType,
        address: {
          addressLine1: req.body.address.addressLine1,
          addressLine2: req.body.address.addressLine2,
          city: req.body.address.city,
          stateProvince: req.body.address.stateProvince,
          country: req.body.address.country,
          postalCode: req.body.address.postalCode,
          latitude: req.body.address.latitude,
          longitude: req.body.address.longitude
        },
        totalValuation: parseFloat(req.body.totalValuation),
        totalTokens: parseInt(req.body.totalTokens, 10),
        pricePerToken: parseFloat(req.body.pricePerToken),
        minimumInvestment: req.body.minimumInvestment ? parseFloat(req.body.minimumInvestment) : undefined,
        expectedAnnualYield: req.body.expectedAnnualYield ? parseFloat(req.body.expectedAnnualYield) : undefined,
        propertySize: req.body.propertySize ? parseFloat(req.body.propertySize) : undefined,
        yearBuilt: req.body.yearBuilt ? parseInt(req.body.yearBuilt, 10) : undefined,
        propertyManagerId: req.body.propertyManagerId,
        managementFeePercentage: req.body.managementFeePercentage ? parseFloat(req.body.managementFeePercentage) : undefined,
        platformFeePercentage: req.body.platformFeePercentage ? parseFloat(req.body.platformFeePercentage) : undefined
      };

      const result = await this.propertyService.registerProperty(registrationRequest);

      if (result.success) {
        logger.info(`Property registered successfully: ${result.property?.id}`, {
          propertyId: result.property?.id,
          userId: req.user?.id
        });

        res.status(201).json({
          success: true,
          message: 'Property registered successfully',
          data: {
            property: result.property
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Property registration failed',
          errors: result.validationErrors || [result.error]
        });
      }

    } catch (error) {
      logger.error('Property registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Get property by ID
   */
  getProperty = async (req: Request, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;

      const property = await this.propertyService.getPropertyById(propertyId);

      if (!property) {
        res.status(404).json({
          success: false,
          message: 'Property not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          property
        }
      });

    } catch (error) {
      logger.error('Get property error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Search and list properties
   */
  searchProperties = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: PropertySearchFilters = {
        country: req.query.country as string,
        propertyType: req.query.propertyType as PropertyType,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        minYield: req.query.minYield ? parseFloat(req.query.minYield as string) : undefined,
        maxYield: req.query.maxYield ? parseFloat(req.query.maxYield as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
        sortBy: req.query.sortBy as 'price' | 'yield' | 'created' | 'valuation',
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await this.propertyService.searchProperties(filters);

      res.json({
        success: true,
        data: {
          properties: result.properties,
          pagination: result.pagination,
          total: result.total
        }
      });

    } catch (error) {
      logger.error('Search properties error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Update property status
   */
  updatePropertyStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;
      const { status, reason } = req.body;

      if (!status || !Object.values(['draft', 'pending_verification', 'tokenizing', 'active', 'sold_out', 'inactive']).includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status provided'
        });
        return;
      }

      const result = await this.propertyService.updatePropertyStatus(propertyId, status as PropertyStatus, reason);

      if (result.success) {
        logger.info(`Property status updated: ${propertyId} -> ${status}`, {
          propertyId,
          newStatus: status,
          reason,
          userId: req.user?.id
        });

        res.json({
          success: true,
          message: 'Property status updated successfully',
          data: {
            property: result.property
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to update property status'
        });
      }

    } catch (error) {
      logger.error('Update property status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Update property valuation
   */
  updatePropertyValuation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;
      const valuationUpdate: PropertyValuationUpdate = {
        newValuation: parseFloat(req.body.newValuation),
        valuationDate: new Date(req.body.valuationDate || Date.now()),
        valuationMethod: req.body.valuationMethod,
        valuationProvider: req.body.valuationProvider,
        notes: req.body.notes
      };

      if (!valuationUpdate.newValuation || valuationUpdate.newValuation <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid valuation amount'
        });
        return;
      }

      const result = await this.propertyService.updatePropertyValuation(propertyId, valuationUpdate);

      if (result.success) {
        logger.info(`Property valuation updated: ${propertyId}`, {
          propertyId,
          newValuation: valuationUpdate.newValuation,
          method: valuationUpdate.valuationMethod,
          userId: req.user?.id
        });

        res.json({
          success: true,
          message: 'Property valuation updated successfully',
          data: {
            property: result.property
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to update property valuation'
        });
      }

    } catch (error) {
      logger.error('Update property valuation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Get property performance metrics
   */
  getPropertyPerformance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const performance = await this.propertyService.getPropertyPerformance(propertyId, startDate, endDate);

      if (!performance) {
        res.status(404).json({
          success: false,
          message: 'Property not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          performance
        }
      });

    } catch (error) {
      logger.error('Get property performance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Get property statistics
   */
  getPropertyStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const statistics = await this.propertyService.getPropertyStatistics();

      res.json({
        success: true,
        data: {
          statistics
        }
      });

    } catch (error) {
      logger.error('Get property statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Initiate property tokenization
   */
  initiateTokenization = async (req: Request, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;
      const { tokenName, tokenSymbol } = req.body;

      const result = await this.propertyService.initiateTokenization(propertyId, tokenName, tokenSymbol);

      if (result.success) {
        logger.info(`Property tokenization initiated: ${propertyId}`, {
          propertyId,
          tokenId: result.tokenId,
          transactionId: result.transactionId,
          userId: req.user?.id
        });

        res.json({
          success: true,
          message: 'Property tokenization initiated successfully',
          data: {
            tokenId: result.tokenId,
            transactionId: result.transactionId
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to initiate tokenization'
        });
      }

    } catch (error) {
      logger.error('Initiate tokenization error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Upload property documents
   */
  uploadDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files provided'
        });
        return;
      }

      const uploadResults = [];

      for (const file of files) {
        const documentRequest: DocumentUploadRequest = {
          propertyId,
          documentType: req.body.documentType || 'other',
          documentName: file.originalname,
          file: file.buffer,
          mimeType: file.mimetype,
          uploadedBy: req.user?.id
        };

        const result = await this.documentService.uploadDocument(documentRequest);
        uploadResults.push({
          fileName: file.originalname,
          success: result.success,
          document: result.document,
          error: result.error
        });
      }

      const successCount = uploadResults.filter(r => r.success).length;
      const failureCount = uploadResults.length - successCount;

      logger.info(`Document upload completed for property ${propertyId}`, {
        propertyId,
        totalFiles: files.length,
        successCount,
        failureCount,
        userId: req.user?.id
      });

      res.json({
        success: successCount > 0,
        message: `${successCount} documents uploaded successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        data: {
          results: uploadResults
        }
      });

    } catch (error) {
      logger.error('Upload documents error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Get property documents
   */
  getPropertyDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;

      const documents = await this.documentService.getPropertyDocuments(propertyId);

      res.json({
        success: true,
        data: {
          documents
        }
      });

    } catch (error) {
      logger.error('Get property documents error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Get document download URL
   */
  getDocumentDownloadUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;

      const result = await this.documentService.getDocumentDownloadUrl(documentId);

      if (result.success) {
        res.json({
          success: true,
          data: {
            downloadUrl: result.url
          }
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.error || 'Document not found'
        });
      }

    } catch (error) {
      logger.error('Get document download URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Update document verification status
   */
  updateDocumentVerification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const { status, notes } = req.body;

      if (!status || !['pending', 'verified', 'rejected'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid verification status'
        });
        return;
      }

      const document = await this.documentService.updateVerificationStatus(
        documentId,
        status,
        req.user?.id,
        notes
      );

      if (document) {
        logger.info(`Document verification status updated: ${documentId} -> ${status}`, {
          documentId,
          status,
          verifiedBy: req.user?.id
        });

        res.json({
          success: true,
          message: 'Document verification status updated successfully',
          data: {
            document
          }
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

    } catch (error) {
      logger.error('Update document verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };

  /**
   * Delete document
   */
  deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;

      const result = await this.documentService.deleteDocument(documentId);

      if (result.success) {
        logger.info(`Document deleted: ${documentId}`, {
          documentId,
          deletedBy: req.user?.id
        });

        res.json({
          success: true,
          message: 'Document deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to delete document'
        });
      }

    } catch (error) {
      logger.error('Delete document error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };
}