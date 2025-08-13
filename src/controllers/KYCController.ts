import { Request, Response } from 'express';
import { KYCService, KYCSubmission } from '../services/KYCService';
import { ComplianceService } from '../services/ComplianceService';
import { KYCDocument } from '../types/entities';
import { logger } from '../utils/logger';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

export class KYCController {
  private kycService: KYCService;
  private complianceService: ComplianceService;
  public upload = upload;

  constructor() {
    this.kycService = new KYCService();
    this.complianceService = new ComplianceService();
  }

  /**
   * Submit KYC documents for verification
   */
  submitKYC = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        documents: Joi.array().items(
          Joi.object({
            type: Joi.string().valid(
              'passport', 'national_id', 'drivers_license', 
              'utility_bill', 'bank_statement'
            ).required(),
            documentNumber: Joi.string().optional(),
            expiryDate: Joi.date().optional(),
            issueDate: Joi.date().optional(),
            issuingCountry: Joi.string().length(3).optional()
          })
        ).min(1).required(),
        personalInfo: Joi.object({
          firstName: Joi.string().required(),
          lastName: Joi.string().required(),
          dateOfBirth: Joi.date().required(),
          nationality: Joi.string().length(3).required(),
          address: Joi.object({
            addressLine1: Joi.string().required(),
            addressLine2: Joi.string().optional(),
            city: Joi.string().required(),
            stateProvince: Joi.string().optional(),
            country: Joi.string().length(3).required(),
            postalCode: Joi.string().optional()
          }).required()
        }).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
        return;
      }

      // Process uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'At least one document file is required'
        });
        return;
      }

      // Convert files to base64 and attach to documents
      const documentsWithFiles: KYCDocument[] = value.documents.map((doc: any, index: number) => {
        const file = files[index];
        if (file) {
          return {
            ...doc,
            frontImage: file.buffer.toString('base64'),
            // For documents that have front/back (like ID cards), 
            // you would handle multiple files per document here
          };
        }
        return doc;
      });

      const submission: KYCSubmission = {
        userId: req.user.id,
        documents: documentsWithFiles,
        personalInfo: value.personalInfo
      };

      // Submit KYC for verification
      const result = await this.kycService.submitKYC(submission);

      // Record audit event
      await this.complianceService.recordAuditEvent({
        userId: req.user.id,
        action: 'kyc_submitted',
        resourceType: 'kyc',
        resourceId: req.user.id,
        newValues: {
          provider: result.provider,
          reference: result.reference,
          status: result.status
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          status: result.status,
          provider: result.provider,
          reference: result.reference,
          confidence: result.confidence,
          reasons: result.reasons,
          requiredDocuments: result.requiredDocuments
        }
      });
    } catch (error) {
      logger.error('KYC submission failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Get KYC status for current user
   */
  getKYCStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const status = await this.kycService.getKYCStatus(req.user.id);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Get KYC status failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get KYC status'
      });
    }
  };

  /**
   * Resubmit KYC after rejection
   */
  resubmitKYC = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        documents: Joi.array().items(
          Joi.object({
            type: Joi.string().valid(
              'passport', 'national_id', 'drivers_license', 
              'utility_bill', 'bank_statement'
            ).required(),
            documentNumber: Joi.string().optional(),
            expiryDate: Joi.date().optional(),
            issueDate: Joi.date().optional(),
            issuingCountry: Joi.string().length(3).optional()
          })
        ).min(1).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
        return;
      }

      // Process uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'At least one document file is required'
        });
        return;
      }

      // Convert files to base64 and attach to documents
      const documentsWithFiles: KYCDocument[] = value.documents.map((doc: any, index: number) => {
        const file = files[index];
        if (file) {
          return {
            ...doc,
            frontImage: file.buffer.toString('base64')
          };
        }
        return doc;
      });

      // Resubmit KYC
      const result = await this.kycService.resubmitKYC(req.user.id, documentsWithFiles);

      // Record audit event
      await this.complianceService.recordAuditEvent({
        userId: req.user.id,
        action: 'kyc_resubmitted',
        resourceType: 'kyc',
        resourceId: req.user.id,
        newValues: {
          provider: result.provider,
          reference: result.reference,
          status: result.status
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          status: result.status,
          provider: result.provider,
          reference: result.reference,
          confidence: result.confidence,
          reasons: result.reasons,
          requiredDocuments: result.requiredDocuments
        }
      });
    } catch (error) {
      logger.error('KYC resubmission failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Perform AML screening on current user
   */
  performAMLScreening = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const result = await this.kycService.performAMLScreening(req.user.id);

      // Record audit event
      await this.complianceService.recordAuditEvent({
        userId: req.user.id,
        action: 'aml_screening_performed',
        resourceType: 'aml',
        resourceId: req.user.id,
        newValues: {
          passed: result.passed,
          riskLevel: result.riskLevel,
          reference: result.reference
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('AML screening failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'AML screening failed'
      });
    }
  };

  /**
   * Get enhanced due diligence report (admin only)
   */
  getEnhancedDueDiligence = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Check if user has admin role
      if (!req.tokenPayload?.roles.includes('admin')) {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const userId = req.params.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID required'
        });
        return;
      }

      const result = await this.complianceService.performEnhancedDueDiligence(userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Enhanced due diligence failed', {
        error: error.message,
        userId: req.params.userId,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Enhanced due diligence failed'
      });
    }
  };

  /**
   * Get compliance report (admin only)
   */
  getComplianceReport = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Check if user has admin role
      if (!req.tokenPayload?.roles.includes('admin')) {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const schema = Joi.object({
        reportType: Joi.string().valid(
          'kyc_summary', 'transaction_monitoring', 'aml_screening', 'suspicious_activity'
        ).required(),
        startDate: Joi.date().required(),
        endDate: Joi.date().required()
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const report = await this.complianceService.generateComplianceReport(
        value.reportType,
        new Date(value.startDate),
        new Date(value.endDate)
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Compliance report generation failed', {
        error: error.message,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report'
      });
    }
  };
}