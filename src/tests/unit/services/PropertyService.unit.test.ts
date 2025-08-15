import { PropertyService } from '../../../services/PropertyService';
import { PropertyModel } from '../../../models/PropertyModel';
import { PropertyTokenizationService } from '../../../services/PropertyTokenizationService';
import { testUtils } from '../../setup';

// Mock dependencies
jest.mock('../../../models/PropertyModel');
jest.mock('../../../services/PropertyTokenizationService');

describe('PropertyService', () => {
  let propertyService: PropertyService;
  let mockPropertyModel: jest.Mocked<PropertyModel>;
  let mockTokenizationService: jest.Mocked<PropertyTokenizationService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    propertyService = new PropertyService();
    
    // Get mocked instances
    mockPropertyModel = PropertyModel.prototype as jest.Mocked<PropertyModel>;
    mockTokenizationService = PropertyTokenizationService.prototype as jest.Mocked<PropertyTokenizationService>;
  });

  describe('registerProperty', () => {
    const validPropertyData = {
      name: 'Test Property',
      propertyType: 'residential' as const,
      address: {
        addressLine1: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
      },
      totalValuation: 1000000,
      totalTokens: 10000,
      pricePerToken: 100,
    };

    it('should register a valid property successfully', async () => {
      // Arrange
      const mockProperty = {
        id: 'property-123',
        ...validPropertyData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPropertyModel.createProperty = jest.fn().mockResolvedValue(mockProperty);

      // Act
      const result = await propertyService.registerProperty(validPropertyData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.property).toEqual(mockProperty);
      expect(mockPropertyModel.createProperty).toHaveBeenCalledWith(
        expect.objectContaining(validPropertyData)
      );
    });

    it('should reject property with invalid data', async () => {
      // Arrange
      const invalidPropertyData = {
        ...validPropertyData,
        name: '', // Invalid: empty name
        totalValuation: -1000, // Invalid: negative valuation
      };

      // Act
      const result = await propertyService.registerProperty(invalidPropertyData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain('Property name is required');
      expect(result.validationErrors).toContain('Total valuation must be greater than 0');
      expect(mockPropertyModel.createProperty).not.toHaveBeenCalled();
    });

    it('should validate token economics', async () => {
      // Arrange
      const invalidTokenEconomics = {
        ...validPropertyData,
        totalValuation: 1000000,
        totalTokens: 5000,
        pricePerToken: 100, // 5000 * 100 = 500000 ≠ 1000000
      };

      // Act
      const result = await propertyService.registerProperty(invalidTokenEconomics);

      // Assert
      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain(
        'Token economics mismatch: total tokens × price per token should equal total valuation'
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockPropertyModel.createProperty = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await propertyService.registerProperty(validPropertyData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getPropertyById', () => {
    it('should return property when found', async () => {
      // Arrange
      const propertyId = 'property-123';
      const mockProperty = {
        id: propertyId,
        name: 'Test Property',
        totalValuation: 1000000,
      };

      mockPropertyModel.findById = jest.fn().mockResolvedValue(mockProperty);

      // Act
      const result = await propertyService.getPropertyById(propertyId);

      // Assert
      expect(result).toEqual(mockProperty);
      expect(mockPropertyModel.findById).toHaveBeenCalledWith(propertyId);
    });

    it('should return null when property not found', async () => {
      // Arrange
      const propertyId = 'non-existent';
      mockPropertyModel.findById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await propertyService.getPropertyById(propertyId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const propertyId = 'property-123';
      mockPropertyModel.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(propertyService.getPropertyById(propertyId)).rejects.toThrow('Database error');
    });
  });

  describe('searchProperties', () => {
    it('should return paginated properties with filters', async () => {
      // Arrange
      const filters = {
        propertyType: 'residential' as const,
        minPrice: 50,
        maxPrice: 200,
        limit: 10,
        offset: 0,
      };

      const mockSearchResult = {
        properties: [
          { id: '1', name: 'Property 1', pricePerToken: 100 },
          { id: '2', name: 'Property 2', pricePerToken: 150 },
        ],
        total: 25,
      };

      mockPropertyModel.searchProperties = jest.fn().mockResolvedValue(mockSearchResult);

      // Act
      const result = await propertyService.searchProperties(filters);

      // Assert
      expect(result.properties).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(3); // Math.ceil(25/10)
      expect(mockPropertyModel.searchProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyType: 'residential',
          minPrice: 50,
          maxPrice: 200,
          limit: 10,
          offset: 0,
        })
      );
    });

    it('should apply sorting when specified', async () => {
      // Arrange
      const filters = {
        sortBy: 'price' as const,
        sortOrder: 'desc' as const,
      };

      const mockProperties = [
        { id: '1', name: 'Property 1', pricePerToken: 200 },
        { id: '2', name: 'Property 2', pricePerToken: 100 },
      ];

      mockPropertyModel.searchProperties = jest.fn().mockResolvedValue({
        properties: mockProperties,
        total: 2,
      });

      // Act
      const result = await propertyService.searchProperties(filters);

      // Assert
      expect(result.properties[0].pricePerToken).toBe(200);
      expect(result.properties[1].pricePerToken).toBe(100);
    });
  });

  describe('updatePropertyValuation', () => {
    it('should update property valuation and recalculate token price', async () => {
      // Arrange
      const propertyId = 'property-123';
      const currentProperty = {
        id: propertyId,
        totalValuation: 1000000,
        totalTokens: 10000,
        pricePerToken: 100,
      };

      const valuationUpdate = {
        newValuation: 1200000,
        valuationDate: new Date(),
        valuationMethod: 'appraisal',
        notes: 'Market appreciation',
      };

      mockPropertyModel.findById = jest.fn().mockResolvedValue(currentProperty);
      mockPropertyModel.updateById = jest.fn().mockResolvedValue(true);

      // Act
      const result = await propertyService.updatePropertyValuation(propertyId, valuationUpdate);

      // Assert
      expect(result.success).toBe(true);
      expect(mockPropertyModel.updateById).toHaveBeenCalledWith(
        propertyId,
        expect.objectContaining({
          total_valuation: 1200000,
          price_per_token: 120, // 1200000 / 10000
        })
      );
    });

    it('should handle property not found', async () => {
      // Arrange
      const propertyId = 'non-existent';
      const valuationUpdate = {
        newValuation: 1200000,
        valuationDate: new Date(),
        valuationMethod: 'appraisal',
      };

      mockPropertyModel.findById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await propertyService.updatePropertyValuation(propertyId, valuationUpdate);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Property not found');
    });
  });

  describe('getPropertyPerformance', () => {
    it('should calculate property performance metrics', async () => {
      // Arrange
      const propertyId = 'property-123';
      const mockProperty = {
        id: propertyId,
        totalTokens: 10000,
        availableTokens: 5000,
        pricePerToken: 100,
        totalValuation: 1200000,
        expectedAnnualYield: 0.08,
      };

      mockPropertyModel.findById = jest.fn().mockResolvedValue(mockProperty);

      // Mock private methods (would need to be made public or tested differently in real implementation)
      jest.spyOn(propertyService as any, 'getPropertyInvestmentStats').mockResolvedValue({
        totalInvestors: 50,
        totalInvested: 500000,
      });

      jest.spyOn(propertyService as any, 'getTotalDividendsPaid').mockResolvedValue(40000);

      // Act
      const result = await propertyService.getPropertyPerformance(propertyId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.propertyId).toBe(propertyId);
      expect(result?.totalInvestors).toBe(50);
      expect(result?.totalInvested).toBe(500000);
      expect(result?.currentValue).toBe(1200000);
      expect(result?.totalDividendsPaid).toBe(40000);
      expect(result?.currentYield).toBe(0.08);
    });

    it('should return null for non-existent property', async () => {
      // Arrange
      const propertyId = 'non-existent';
      mockPropertyModel.findById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await propertyService.getPropertyPerformance(propertyId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('initiateTokenization', () => {
    it('should initiate tokenization for valid property', async () => {
      // Arrange
      const propertyId = 'property-123';
      const mockProperty = {
        id: propertyId,
        name: 'Test Property',
        totalTokens: 10000,
        propertyType: 'residential',
        address: { city: 'Test City', country: 'Test Country' },
        totalValuation: 1000000,
        expectedAnnualYield: 0.08,
      };

      const mockValidation = { valid: true, errors: [] };
      const mockTokenizationResult = {
        success: true,
        tokenId: 'token-123',
        transactionId: 'tx-123',
      };

      mockPropertyModel.findById = jest.fn().mockResolvedValue(mockProperty);
      mockTokenizationService.validatePropertyForTokenization = jest.fn().mockResolvedValue(mockValidation);
      mockTokenizationService.tokenizeProperty = jest.fn().mockResolvedValue(mockTokenizationResult);

      // Act
      const result = await propertyService.initiateTokenization(propertyId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tokenId).toBe('token-123');
      expect(result.transactionId).toBe('tx-123');
      expect(mockTokenizationService.tokenizeProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId,
          tokenName: 'Test Property Token',
          totalSupply: 10000,
          decimals: 0,
        })
      );
    });

    it('should reject tokenization for invalid property', async () => {
      // Arrange
      const propertyId = 'property-123';
      const mockProperty = { id: propertyId, name: 'Test Property' };
      const mockValidation = {
        valid: false,
        errors: ['Missing required documents', 'Incomplete KYC'],
      };

      mockPropertyModel.findById = jest.fn().mockResolvedValue(mockProperty);
      mockTokenizationService.validatePropertyForTokenization = jest.fn().mockResolvedValue(mockValidation);

      // Act
      const result = await propertyService.initiateTokenization(propertyId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required documents');
      expect(mockTokenizationService.tokenizeProperty).not.toHaveBeenCalled();
    });
  });

  describe('getPropertyStatistics', () => {
    it('should return comprehensive property statistics', async () => {
      // Arrange
      const mockStats = {
        totalProperties: 150,
        activeProperties: 120,
        totalValuation: 50000000,
        totalTokensIssued: 500000,
        averageYield: 0.085,
      };

      const mockPropertiesByType = {
        residential: 80,
        commercial: 50,
        industrial: 15,
        land: 5,
        mixed_use: 0,
      };

      const mockPropertiesByCountry = {
        'Nigeria': 60,
        'Kenya': 40,
        'Ghana': 30,
        'South Africa': 20,
      };

      mockPropertyModel.getPropertyStats = jest.fn().mockResolvedValue(mockStats);
      jest.spyOn(propertyService as any, 'getPropertiesByType').mockResolvedValue(mockPropertiesByType);
      jest.spyOn(propertyService as any, 'getPropertiesByCountry').mockResolvedValue(mockPropertiesByCountry);

      // Act
      const result = await propertyService.getPropertyStatistics();

      // Assert
      expect(result.totalProperties).toBe(150);
      expect(result.activeProperties).toBe(120);
      expect(result.totalValuation).toBe(50000000);
      expect(result.propertiesByType.residential).toBe(80);
      expect(result.propertiesByCountry['Nigeria']).toBe(60);
    });
  });
});

// Integration test example
describe('PropertyService Integration', () => {
  beforeEach(async () => {
    await testUtils.cleanTestData();
  });

  it('should handle complete property lifecycle', async () => {
    // This would be an integration test using real database
    // but with test data and isolated test environment
    
    const propertyService = new PropertyService();
    
    // Register property
    const propertyData = {
      name: 'Integration Test Property',
      propertyType: 'residential' as const,
      address: {
        addressLine1: '123 Integration St',
        city: 'Test City',
        country: 'Test Country',
      },
      totalValuation: 1000000,
      totalTokens: 10000,
      pricePerToken: 100,
    };

    const registrationResult = await propertyService.registerProperty(propertyData);
    expect(registrationResult.success).toBe(true);
    
    const propertyId = registrationResult.property!.id;

    // Get property
    const retrievedProperty = await propertyService.getPropertyById(propertyId);
    expect(retrievedProperty).toBeDefined();
    expect(retrievedProperty!.name).toBe(propertyData.name);

    // Update valuation
    const valuationUpdate = {
      newValuation: 1200000,
      valuationDate: new Date(),
      valuationMethod: 'market_analysis',
    };

    const valuationResult = await propertyService.updatePropertyValuation(propertyId, valuationUpdate);
    expect(valuationResult.success).toBe(true);

    // Verify updated valuation
    const updatedProperty = await propertyService.getPropertyById(propertyId);
    expect(updatedProperty!.totalValuation).toBe(1200000);
    expect(updatedProperty!.pricePerToken).toBe(120); // 1200000 / 10000
  });
});