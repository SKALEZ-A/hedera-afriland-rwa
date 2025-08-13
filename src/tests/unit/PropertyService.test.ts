import { PropertyService, PropertyRegistrationRequest } from '../../services/PropertyService';
import { PropertyModel } from '../../models/PropertyModel';
import { PropertyTokenizationService } from '../../services/PropertyTokenizationService';
import { Property, PropertyType, PropertyStatus } from '../../types/entities';

// Mock dependencies
jest.mock('../../models/PropertyModel');
jest.mock('../../services/PropertyTokenizationService');
jest.mock('../../utils/logger');

const MockedPropertyModel = PropertyModel as jest.MockedClass<typeof PropertyModel>;
const MockedTokenizationService = PropertyTokenizationService as jest.MockedClass<typeof PropertyTokenizationService>;

describe('PropertyService', () => {
  let propertyService: PropertyService;
  let mockPropertyModel: jest.Mocked<PropertyModel>;
  let mockTokenizationService: jest.Mocked<PropertyTokenizationService>;

  const mockProperty: Property = {
    id: 'prop-123',
    tokenId: 'token-456',
    name: 'Test Property',
    description: 'A test property',
    propertyType: 'residential' as PropertyType,
    address: {
      addressLine1: '123 Test St',
      city: 'Test City',
      country: 'USA',
      postalCode: '12345'
    },
    totalValuation: 1000000,
    totalTokens: 10000,
    availableTokens: 8000,
    pricePerToken: 100,
    minimumInvestment: 100,
    expectedAnnualYield: 8.5,
    propertySize: 150,
    yearBuilt: 2020,
    managementFeePercentage: 1.5,
    platformFeePercentage: 2.5,
    status: 'active' as PropertyStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPropertyModel = new MockedPropertyModel() as jest.Mocked<PropertyModel>;
    mockTokenizationService = new MockedTokenizationService() as jest.Mocked<PropertyTokenizationService>;
    
    propertyService = new PropertyService();
    (propertyService as any).propertyModel = mockPropertyModel;
    (propertyService as any).tokenizationService = mockTokenizationService;
  });

  describe('registerProperty', () => {
    const validRegistrationRequest: PropertyRegistrationRequest = {
      name: 'Test Property',
      description: 'A test property',
      propertyType: 'residential' as PropertyType,
      address: {
        addressLine1: '123 Test St',
        city: 'Test City',
        country: 'USA',
        postalCode: '12345'
      },
      totalValuation: 1000000,
      totalTokens: 10000,
      pricePerToken: 100,
      minimumInvestment: 100,
      expectedAnnualYield: 8.5,
      propertySize: 150,
      yearBuilt: 2020,
      managementFeePercentage: 1.5,
      platformFeePercentage: 2.5
    };

    it('should successfully register a valid property', async () => {
      mockPropertyModel.createProperty.mockResolvedValue(mockProperty);

      const result = await propertyService.registerProperty(validRegistrationRequest);

      expect(result.success).toBe(true);
      expect(result.property).toEqual(mockProperty);
      expect(result.validationErrors).toBeUndefined();
      expect(mockPropertyModel.createProperty).toHaveBeenCalledWith(validRegistrationRequest);
    });

    it('should fail validation for missing required fields', async () => {
      const invalidRequest = {
        ...validRegistrationRequest,
        name: '', // Empty name
        address: {
          ...validRegistrationRequest.address,
          addressLine1: '' // Empty address
        }
      };

      const result = await propertyService.registerProperty(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain('Property name is required');
      expect(result.validationErrors).toContain('Complete address is required (address line 1, city, country)');
      expect(mockPropertyModel.createProperty).not.toHaveBeenCalled();
    });

    it('should fail validation for invalid token economics', async () => {
      const invalidRequest = {
        ...validRegistrationRequest,
        totalValuation: 1000000,
        totalTokens: 10000,
        pricePerToken: 200 // This would make total value 2,000,000 instead of 1,000,000
      };

      const result = await propertyService.registerProperty(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain('Token economics mismatch: total tokens × price per token should equal total valuation');
      expect(mockPropertyModel.createProperty).not.toHaveBeenCalled();
    });

    it('should fail validation for invalid yield percentage', async () => {
      const invalidRequest = {
        ...validRegistrationRequest,
        expectedAnnualYield: 150 // Invalid yield > 100%
      };

      const result = await propertyService.registerProperty(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain('Expected annual yield must be between 0% and 100%');
      expect(mockPropertyModel.createProperty).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPropertyModel.createProperty.mockRejectedValue(new Error('Database error'));

      const result = await propertyService.registerProperty(validRegistrationRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getPropertyById', () => {
    it('should return property when found', async () => {
      mockPropertyModel.findById.mockResolvedValue(mockProperty);

      const result = await propertyService.getPropertyById('prop-123');

      expect(result).toEqual(mockProperty);
      expect(mockPropertyModel.findById).toHaveBeenCalledWith('prop-123');
    });

    it('should return null when property not found', async () => {
      mockPropertyModel.findById.mockResolvedValue(null);

      const result = await propertyService.getPropertyById('nonexistent');

      expect(result).toBeNull();
      expect(mockPropertyModel.findById).toHaveBeenCalledWith('nonexistent');
    });

    it('should throw error when database fails', async () => {
      mockPropertyModel.findById.mockRejectedValue(new Error('Database error'));

      await expect(propertyService.getPropertyById('prop-123')).rejects.toThrow('Database error');
    });
  });

  describe('searchProperties', () => {
    const mockSearchResult = {
      properties: [mockProperty],
      total: 1
    };

    it('should return search results with pagination', async () => {
      mockPropertyModel.searchProperties.mockResolvedValue(mockSearchResult);

      const result = await propertyService.searchProperties({
        country: 'USA',
        propertyType: 'residential' as PropertyType,
        limit: 20,
        offset: 0
      });

      expect(result.properties).toEqual([mockProperty]);
      expect(result.total).toBe(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        totalPages: 1
      });
    });

    it('should apply default pagination when not specified', async () => {
      mockPropertyModel.searchProperties.mockResolvedValue(mockSearchResult);

      await propertyService.searchProperties({});

      expect(mockPropertyModel.searchProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 0
        })
      );
    });

    it('should handle sorting when specified', async () => {
      mockPropertyModel.searchProperties.mockResolvedValue(mockSearchResult);

      await propertyService.searchProperties({
        sortBy: 'price',
        sortOrder: 'asc'
      });

      expect(mockPropertyModel.searchProperties).toHaveBeenCalled();
    });
  });

  describe('updatePropertyStatus', () => {
    it('should successfully update property status', async () => {
      const updatedProperty = { ...mockProperty, status: 'inactive' as PropertyStatus };
      mockPropertyModel.updateStatus.mockResolvedValue(updatedProperty);

      const result = await propertyService.updatePropertyStatus('prop-123', 'inactive', 'Test reason');

      expect(result.success).toBe(true);
      expect(result.property?.status).toBe('inactive');
      expect(mockPropertyModel.updateStatus).toHaveBeenCalledWith('prop-123', 'inactive');
    });

    it('should fail when property not found', async () => {
      mockPropertyModel.updateStatus.mockResolvedValue(null);

      const result = await propertyService.updatePropertyStatus('nonexistent', 'inactive');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Property not found');
    });
  });

  describe('updatePropertyValuation', () => {
    it('should successfully update property valuation', async () => {
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      mockPropertyModel.updateById.mockResolvedValue({ ...mockProperty, total_valuation: 1200000 });
      mockPropertyModel.findById.mockResolvedValueOnce(mockProperty).mockResolvedValueOnce({
        ...mockProperty,
        totalValuation: 1200000,
        pricePerToken: 120
      });

      const result = await propertyService.updatePropertyValuation('prop-123', {
        newValuation: 1200000,
        valuationDate: new Date(),
        valuationMethod: 'professional_appraisal'
      });

      expect(result.success).toBe(true);
      expect(mockPropertyModel.updateById).toHaveBeenCalledWith('prop-123', expect.objectContaining({
        total_valuation: 1200000,
        price_per_token: 120
      }));
    });

    it('should fail when property not found', async () => {
      mockPropertyModel.findById.mockResolvedValue(null);

      const result = await propertyService.updatePropertyValuation('nonexistent', {
        newValuation: 1200000,
        valuationDate: new Date(),
        valuationMethod: 'professional_appraisal'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Property not found');
    });
  });

  describe('initiateTokenization', () => {
    it('should successfully initiate tokenization', async () => {
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      mockTokenizationService.validatePropertyForTokenization.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      mockTokenizationService.tokenizeProperty.mockResolvedValue({
        success: true,
        tokenId: 'token-789',
        transactionId: 'tx-123'
      });

      const result = await propertyService.initiateTokenization('prop-123', 'Test Token', 'TEST');

      expect(result.success).toBe(true);
      expect(result.tokenId).toBe('token-789');
      expect(result.transactionId).toBe('tx-123');
    });

    it('should fail when property validation fails', async () => {
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      mockTokenizationService.validatePropertyForTokenization.mockResolvedValue({
        valid: false,
        errors: ['Property not ready for tokenization'],
        warnings: []
      });

      const result = await propertyService.initiateTokenization('prop-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Property validation failed');
    });

    it('should fail when property not found', async () => {
      mockPropertyModel.findById.mockResolvedValue(null);

      const result = await propertyService.initiateTokenization('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Property not found');
    });
  });

  describe('getPropertyPerformance', () => {
    it('should return performance metrics for existing property', async () => {
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      
      // Mock the private method calls
      jest.spyOn(propertyService as any, 'getPropertyInvestmentStats').mockResolvedValue({
        totalInvestors: 5,
        totalInvested: 200000
      });
      jest.spyOn(propertyService as any, 'getTotalDividendsPaid').mockResolvedValue(15000);

      const result = await propertyService.getPropertyPerformance('prop-123');

      expect(result).toBeDefined();
      expect(result?.propertyId).toBe('prop-123');
      expect(result?.totalInvestors).toBe(5);
      expect(result?.totalInvested).toBe(200000);
      expect(result?.totalDividendsPaid).toBe(15000);
    });

    it('should return null for non-existent property', async () => {
      mockPropertyModel.findById.mockResolvedValue(null);

      const result = await propertyService.getPropertyPerformance('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPropertyStatistics', () => {
    it('should return comprehensive property statistics', async () => {
      const mockStats = {
        totalProperties: 10,
        activeProperties: 8,
        totalValuation: 10000000,
        totalTokensIssued: 100000,
        averageYield: 7.5
      };

      mockPropertyModel.getPropertyStats.mockResolvedValue(mockStats);
      
      // Mock the private method calls
      jest.spyOn(propertyService as any, 'getPropertiesByType').mockResolvedValue({
        residential: 5,
        commercial: 3,
        industrial: 1,
        land: 1,
        mixed_use: 0
      });
      jest.spyOn(propertyService as any, 'getPropertiesByCountry').mockResolvedValue({
        USA: 5,
        GBR: 3,
        DEU: 2
      });

      const result = await propertyService.getPropertyStatistics();

      expect(result.totalProperties).toBe(10);
      expect(result.activeProperties).toBe(8);
      expect(result.propertiesByType).toBeDefined();
      expect(result.propertiesByCountry).toBeDefined();
    });
  });
});