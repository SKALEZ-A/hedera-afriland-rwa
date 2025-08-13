import { KYCService } from '../../services/KYCService';
import { UserModel } from '../../models/UserModel';
import { User, KYCDocument } from '../../types/entities';

// Mock dependencies
jest.mock('../../models/UserModel');
jest.mock('../../utils/logger');

describe('KYCService', () => {
  let kycService: KYCService;
  let mockUserModel: jest.Mocked<UserModel>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    kycStatus: 'pending',
    verificationLevel: 'basic',
    isAccreditedInvestor: false,
    emailVerified: false,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserModel = new UserModel() as jest.Mocked<UserModel>;
    kycService = new KYCService();
    
    // Replace the private userModel instance
    (kycService as any).userModel = mockUserModel;
  });

  describe('submitKYC', () => {
    it('should submit KYC successfully with valid documents', async () => {
      const documents: KYCDocument[] = [
        {
          type: 'passport',
          frontImage: 'base64-image-data',
          documentNumber: 'P123456789',
          expiryDate: new Date('2030-12-31'),
          issuingCountry: 'USA'
        },
        {
          type: 'utility_bill',
          frontImage: 'base64-image-data'
        }
      ];

      const submission = {
        userId: mockUser.id,
        documents
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.updateKYCStatus.mockResolvedValue(mockUser);

      const result = await kycService.submitKYC(submission);

      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockUserModel.updateKYCStatus).toHaveBeenCalledWith(
        mockUser.id,
        'in_review'
      );
      expect(mockUserModel.updateKYCStatus).toHaveBeenCalledWith(
        mockUser.id,
        'approved',
        'mock',
        expect.any(String)
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.provider).toBe('mock');
      expect(result.reference).toMatch(/^MOCK_/);
    });

    it('should reject KYC with missing required documents', async () => {
      const documents: KYCDocument[] = [
        {
          type: 'utility_bill',
          frontImage: 'base64-image-data'
        }
      ];

      const submission = {
        userId: mockUser.id,
        documents
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.updateKYCStatus.mockResolvedValue(mockUser);

      const result = await kycService.submitKYC(submission);

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.reasons).toContain('Missing valid government-issued ID');
    });

    it('should throw error if user not found', async () => {
      const documents: KYCDocument[] = [
        {
          type: 'passport',
          frontImage: 'base64-image-data'
        }
      ];

      const submission = {
        userId: 'non-existent-user',
        documents
      };

      mockUserModel.findById.mockResolvedValue(null);

      await expect(kycService.submitKYC(submission))
        .rejects.toThrow('User not found');

      expect(mockUserModel.updateKYCStatus).not.toHaveBeenCalled();
    });

    it('should update status to rejected on error', async () => {
      const documents: KYCDocument[] = [
        {
          type: 'passport',
          frontImage: 'base64-image-data'
        }
      ];

      const submission = {
        userId: mockUser.id,
        documents
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.updateKYCStatus
        .mockResolvedValueOnce(mockUser) // First call for in_review
        .mockRejectedValueOnce(new Error('Database error')); // Second call fails

      await expect(kycService.submitKYC(submission))
        .rejects.toThrow('Database error');

      expect(mockUserModel.updateKYCStatus).toHaveBeenCalledWith(
        mockUser.id,
        'rejected'
      );
    });
  });

  describe('performAMLScreening', () => {
    it('should perform AML screening successfully', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await kycService.performAMLScreening(mockUser.id);

      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('reference');
      expect(result.reference).toMatch(/^AML_/);
    });

    it('should identify high-risk country', async () => {
      const highRiskUser = {
        ...mockUser,
        nationality: 'AFG' // Afghanistan - high risk country
      };

      mockUserModel.findById.mockResolvedValue(highRiskUser);

      const result = await kycService.performAMLScreening(mockUser.id);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('high');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].type).toBe('high_risk_country');
    });

    it('should identify sanctioned name match', async () => {
      const sanctionedUser = {
        ...mockUser,
        firstName: 'John Doe',
        lastName: 'Sanctioned'
      };

      mockUserModel.findById.mockResolvedValue(sanctionedUser);

      const result = await kycService.performAMLScreening(mockUser.id);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('high');
      expect(result.matches.some(match => match.type === 'sanctions_match')).toBe(true);
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(kycService.performAMLScreening('non-existent-user'))
        .rejects.toThrow('User not found');
    });
  });

  describe('getKYCStatus', () => {
    it('should return KYC status for user', async () => {
      const approvedUser = {
        ...mockUser,
        kycStatus: 'approved' as const,
        kycProvider: 'mock',
        kycReference: 'MOCK_12345678',
        kycCompletedAt: new Date()
      };

      mockUserModel.findById.mockResolvedValue(approvedUser);

      const result = await kycService.getKYCStatus(mockUser.id);

      expect(result.status).toBe('approved');
      expect(result.provider).toBe('mock');
      expect(result.reference).toBe('MOCK_12345678');
      expect(result.completedAt).toEqual(approvedUser.kycCompletedAt);
    });

    it('should return required documents for pending status', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await kycService.getKYCStatus(mockUser.id);

      expect(result.status).toBe('pending');
      expect(result.requiredDocuments).toEqual(['passport', 'utility_bill']);
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(kycService.getKYCStatus('non-existent-user'))
        .rejects.toThrow('User not found');
    });
  });

  describe('resubmitKYC', () => {
    it('should resubmit KYC for rejected user', async () => {
      const rejectedUser = {
        ...mockUser,
        kycStatus: 'rejected' as const
      };

      const documents: KYCDocument[] = [
        {
          type: 'passport',
          frontImage: 'base64-image-data'
        },
        {
          type: 'utility_bill',
          frontImage: 'base64-image-data'
        }
      ];

      mockUserModel.findById.mockResolvedValue(rejectedUser);
      mockUserModel.updateKYCStatus.mockResolvedValue(rejectedUser);

      const result = await kycService.resubmitKYC(mockUser.id, documents);

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
    });

    it('should throw error if user status is not rejected', async () => {
      const approvedUser = {
        ...mockUser,
        kycStatus: 'approved' as const
      };

      mockUserModel.findById.mockResolvedValue(approvedUser);

      await expect(kycService.resubmitKYC(mockUser.id, []))
        .rejects.toThrow('KYC resubmission only allowed for rejected applications');
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(kycService.resubmitKYC('non-existent-user', []))
        .rejects.toThrow('User not found');
    });
  });
});