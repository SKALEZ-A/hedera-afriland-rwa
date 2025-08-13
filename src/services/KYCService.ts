import { UserModel } from '../models/UserModel';
import { User, UserKYCStatus, KYCDocument } from '../types/entities';
import { logger } from '../utils/logger';
// import axios from 'axios'; // Will be used for real KYC provider integrations
import crypto from 'crypto';

export interface KYCSubmission {
  userId: string;
  documents: KYCDocument[];
  personalInfo?: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    nationality: string;
    address: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      stateProvince?: string;
      country: string;
      postalCode?: string;
    };
  };
}

export interface KYCVerificationResult {
  success: boolean;
  status: UserKYCStatus;
  provider: string;
  reference: string;
  confidence?: number;
  reasons?: string[];
  requiredDocuments?: string[];
}

export interface AMLScreeningResult {
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  matches: Array<{
    type: string;
    confidence: number;
    description: string;
  }>;
  reference: string;
}

export class KYCService {
  private userModel: UserModel;
  private kycProviders: Map<string, KYCProvider>;

  constructor() {
    this.userModel = new UserModel();
    this.kycProviders = new Map();
    
    // Initialize KYC providers (mock implementations for demo)
    this.kycProviders.set('jumio', new JumioKYCProvider());
    this.kycProviders.set('onfido', new OnfidoKYCProvider());
    this.kycProviders.set('mock', new MockKYCProvider());
  }

  /**
   * Submit KYC documents for verification
   */
  async submitKYC(submission: KYCSubmission): Promise<KYCVerificationResult> {
    try {
      const user = await this.userModel.findById(submission.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user status to in_review
      await this.userModel.updateKYCStatus(submission.userId, 'in_review');

      // Choose KYC provider based on user's nationality or configuration
      const provider = this.selectKYCProvider(user);
      
      // Submit to KYC provider
      const result = await provider.verifyIdentity(submission);

      // Update user KYC status based on result
      await this.userModel.updateKYCStatus(
        submission.userId,
        result.status,
        result.provider,
        result.reference
      );

      // Log KYC submission
      logger.info('KYC submitted', {
        userId: submission.userId,
        provider: result.provider,
        status: result.status,
        reference: result.reference
      });

      return result;
    } catch (error) {
      logger.error('KYC submission failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: submission.userId
      });
      
      // Only update status to rejected if user exists
      try {
        const user = await this.userModel.findById(submission.userId);
        if (user) {
          await this.userModel.updateKYCStatus(submission.userId, 'rejected');
        }
      } catch (updateError) {
        // Ignore update errors during error handling
      }
      
      throw error;
    }
  }

  /**
   * Perform AML screening on user
   */
  async performAMLScreening(userId: string): Promise<AMLScreeningResult> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Mock AML screening implementation
      const result = await this.mockAMLScreening(user);

      // Log AML screening result
      logger.info('AML screening completed', {
        userId,
        riskLevel: result.riskLevel,
        passed: result.passed,
        reference: result.reference
      });

      return result;
    } catch (error) {
      logger.error('AML screening failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get KYC status for user
   */
  async getKYCStatus(userId: string): Promise<{
    status: UserKYCStatus;
    provider?: string;
    reference?: string;
    completedAt?: Date;
    requiredDocuments?: string[];
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      status: user.kycStatus,
      provider: user.kycProvider,
      reference: user.kycReference,
      completedAt: user.kycCompletedAt,
      requiredDocuments: this.getRequiredDocuments(user.kycStatus)
    };
  }

  /**
   * Resubmit KYC after rejection
   */
  async resubmitKYC(userId: string, documents: KYCDocument[]): Promise<KYCVerificationResult> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.kycStatus !== 'rejected') {
      throw new Error('KYC resubmission only allowed for rejected applications');
    }

    return this.submitKYC({ userId, documents });
  }

  /**
   * Select appropriate KYC provider based on user profile
   */
  private selectKYCProvider(_user: User): KYCProvider {
    // For demo purposes, use mock provider
    // In production, select based on user's nationality, risk profile, etc.
    const providerName = process.env.KYC_PROVIDER || 'mock';
    
    const provider = this.kycProviders.get(providerName);
    if (!provider) {
      throw new Error(`KYC provider ${providerName} not configured`);
    }

    return provider;
  }

  /**
   * Get required documents based on KYC status
   */
  private getRequiredDocuments(status: UserKYCStatus): string[] {
    switch (status) {
      case 'pending':
        return ['passport', 'utility_bill'];
      case 'rejected':
        return ['passport', 'utility_bill', 'bank_statement'];
      default:
        return [];
    }
  }

  /**
   * Mock AML screening implementation
   */
  private async mockAMLScreening(user: User): Promise<AMLScreeningResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock screening logic
    const riskFactors = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for high-risk countries (mock)
    const highRiskCountries = ['AFG', 'IRN', 'PRK', 'SYR'];
    if (user.nationality && highRiskCountries.includes(user.nationality)) {
      riskFactors.push({
        type: 'high_risk_country',
        confidence: 0.8,
        description: 'User from high-risk jurisdiction'
      });
      riskLevel = 'high';
    }

    // Mock name screening against sanctions lists
    const sanctionedNames = ['John Doe Sanctioned', 'Jane Smith Blocked'];
    const fullName = `${user.firstName} ${user.lastName}`;
    
    for (const sanctionedName of sanctionedNames) {
      if (fullName.toLowerCase().includes(sanctionedName.toLowerCase())) {
        riskFactors.push({
          type: 'sanctions_match',
          confidence: 0.9,
          description: `Potential match with sanctioned individual: ${sanctionedName}`
        });
        riskLevel = 'high';
      }
    }

    // Generate reference
    const reference = `AML_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    return {
      passed: riskLevel !== 'high',
      riskLevel,
      matches: riskFactors,
      reference
    };
  }
}

// Abstract KYC Provider interface
abstract class KYCProvider {
  abstract verifyIdentity(submission: KYCSubmission): Promise<KYCVerificationResult>;
}

// Mock KYC Provider for demo purposes
class MockKYCProvider extends KYCProvider {
  async verifyIdentity(submission: KYCSubmission): Promise<KYCVerificationResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock verification logic
    const hasRequiredDocs = submission.documents.some(doc => 
      ['passport', 'national_id', 'drivers_license'].includes(doc.type)
    );

    const hasProofOfAddress = submission.documents.some(doc => 
      ['utility_bill', 'bank_statement'].includes(doc.type)
    );

    let status: UserKYCStatus = 'approved';
    const reasons: string[] = [];

    if (!hasRequiredDocs) {
      status = 'rejected';
      reasons.push('Missing valid government-issued ID');
    }

    if (!hasProofOfAddress) {
      status = 'rejected';
      reasons.push('Missing proof of address document');
    }

    // Random rejection for demo (10% chance)
    if (Math.random() < 0.1 && status === 'approved') {
      status = 'rejected';
      reasons.push('Document quality insufficient for verification');
    }

    const reference = `MOCK_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    return {
      success: status === 'approved',
      status,
      provider: 'mock',
      reference,
      confidence: status === 'approved' ? 0.95 : 0.3,
      ...(reasons.length > 0 && { reasons }),
      ...(status === 'rejected' && { requiredDocuments: ['passport', 'utility_bill'] })
    };
  }
}

// Jumio KYC Provider (mock implementation)
class JumioKYCProvider extends KYCProvider {
  async verifyIdentity(_submission: KYCSubmission): Promise<KYCVerificationResult> {
    // In production, this would integrate with Jumio's API
    // For now, return mock response
    const reference = `JUMIO_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    
    return {
      success: true,
      status: 'approved',
      provider: 'jumio',
      reference,
      confidence: 0.92
    };
  }
}

// Onfido KYC Provider (mock implementation)
class OnfidoKYCProvider extends KYCProvider {
  async verifyIdentity(_submission: KYCSubmission): Promise<KYCVerificationResult> {
    // In production, this would integrate with Onfido's API
    // For now, return mock response
    const reference = `ONFIDO_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    
    return {
      success: true,
      status: 'approved',
      provider: 'onfido',
      reference,
      confidence: 0.88
    };
  }
}