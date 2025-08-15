import { PropertyValuationService } from '../../../services/PropertyValuationService'
import { PropertyModel } from '../../../models/PropertyModel'

// Mock dependencies
jest.mock('../../../models/PropertyModel')
jest.mock('../../../utils/logger')

const mockPropertyModel = PropertyModel as jest.Mocked<typeof PropertyModel>

describe('PropertyValuationService', () => {
  let service: PropertyValuationService
  
  beforeEach(() => {
    service = new PropertyValuationService()
    jest.clearAllMocks()
  })

  describe('calculatePropertyValuation', () => {
    it('should calculate basic property valuation', async () => {
      const propertyData = {
        location: 'Nairobi, Kenya',
        propertyType: 'residential',
        size: 1000, // sq ft
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2020,
        condition: 'excellent'
      }

      const valuation = await service.calculatePropertyValuation(propertyData)

      expect(valuation).toHaveProperty('estimatedValue')
      expect(valuation).toHaveProperty('confidence')
      expect(valuation).toHaveProperty('methodology')
      expect(valuation.estimatedValue).toBeGreaterThan(0)
      expect(valuation.confidence).toBeGreaterThanOrEqual(0)
      expect(valuation.confidence).toBeLessThanOrEqual(1)
    })

    it('should apply location multipliers correctly', async () => {
      const nairobiProperty = {
        location: 'Nairobi, Kenya',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2020,
        condition: 'good'
      }

      const kampalaProperty = {
        ...nairobiProperty,
        location: 'Kampala, Uganda'
      }

      const nairobiValuation = await service.calculatePropertyValuation(nairobiProperty)
      const kampalaValuation = await service.calculatePropertyValuation(kampalaProperty)

      // Nairobi typically has higher property values than Kampala
      expect(nairobiValuation.estimatedValue).toBeGreaterThan(kampalaValuation.estimatedValue)
    })

    it('should handle different property types', async () => {
      const residentialProperty = {
        location: 'Lagos, Nigeria',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2020,
        condition: 'good'
      }

      const commercialProperty = {
        location: 'Lagos, Nigeria',
        propertyType: 'commercial',
        size: 1000,
        yearBuilt: 2020,
        condition: 'good'
      }

      const residentialValuation = await service.calculatePropertyValuation(residentialProperty)
      const commercialValuation = await service.calculatePropertyValuation(commercialProperty)

      expect(residentialValuation.estimatedValue).toBeGreaterThan(0)
      expect(commercialValuation.estimatedValue).toBeGreaterThan(0)
      expect(residentialValuation.methodology).not.toBe(commercialValuation.methodology)
    })

    it('should adjust for property condition', async () => {
      const excellentProperty = {
        location: 'Accra, Ghana',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2020,
        condition: 'excellent'
      }

      const poorProperty = {
        ...excellentProperty,
        condition: 'poor'
      }

      const excellentValuation = await service.calculatePropertyValuation(excellentProperty)
      const poorValuation = await service.calculatePropertyValuation(poorProperty)

      expect(excellentValuation.estimatedValue).toBeGreaterThan(poorValuation.estimatedValue)
    })

    it('should consider property age in valuation', async () => {
      const newProperty = {
        location: 'Kigali, Rwanda',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2023,
        condition: 'excellent'
      }

      const oldProperty = {
        ...newProperty,
        yearBuilt: 1990
      }

      const newValuation = await service.calculatePropertyValuation(newProperty)
      const oldValuation = await service.calculatePropertyValuation(oldProperty)

      expect(newValuation.estimatedValue).toBeGreaterThan(oldValuation.estimatedValue)
    })
  })

  describe('getMarketComparables', () => {
    it('should find comparable properties', async () => {
      const mockComparables = [
        {
          id: '1',
          location: 'Nairobi, Kenya',
          propertyType: 'residential',
          size: 950,
          bedrooms: 3,
          bathrooms: 2,
          salePrice: 15000000,
          saleDate: new Date('2023-01-15')
        },
        {
          id: '2',
          location: 'Nairobi, Kenya',
          propertyType: 'residential',
          size: 1100,
          bedrooms: 3,
          bathrooms: 2,
          salePrice: 18000000,
          saleDate: new Date('2023-02-20')
        }
      ]

      jest.spyOn(service, 'getMarketComparables').mockResolvedValue(mockComparables)

      const searchCriteria = {
        location: 'Nairobi, Kenya',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2
      }

      const comparables = await service.getMarketComparables(searchCriteria)

      expect(comparables).toHaveLength(2)
      expect(comparables[0]).toHaveProperty('salePrice')
      expect(comparables[0]).toHaveProperty('saleDate')
    })

    it('should filter comparables by date range', async () => {
      const searchCriteria = {
        location: 'Nairobi, Kenya',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        maxAge: 180 // days
      }

      const comparables = await service.getMarketComparables(searchCriteria)

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 180)

      comparables.forEach(comp => {
        expect(comp.saleDate.getTime()).toBeGreaterThan(cutoffDate.getTime())
      })
    })
  })

  describe('updatePropertyValuation', () => {
    it('should update existing property valuation', async () => {
      const propertyId = 'test-property-id'
      const mockProperty = {
        id: propertyId,
        name: 'Test Property',
        totalValuation: 15000000,
        lastValuationDate: new Date('2023-01-01')
      }

      mockPropertyModel.findById.mockResolvedValue(mockProperty)
      mockPropertyModel.update.mockResolvedValue({ ...mockProperty, totalValuation: 18000000 })

      const updatedProperty = await service.updatePropertyValuation(propertyId)

      expect(mockPropertyModel.findById).toHaveBeenCalledWith(propertyId)
      expect(mockPropertyModel.update).toHaveBeenCalled()
      expect(updatedProperty.totalValuation).toBeGreaterThan(mockProperty.totalValuation)
    })

    it('should handle property not found', async () => {
      const propertyId = 'non-existent-property'
      
      mockPropertyModel.findById.mockResolvedValue(null)

      await expect(service.updatePropertyValuation(propertyId))
        .rejects.toThrow('Property not found')
    })
  })

  describe('getValuationHistory', () => {
    it('should return valuation history for property', async () => {
      const propertyId = 'test-property-id'
      const mockHistory = [
        {
          date: new Date('2023-01-01'),
          value: 15000000,
          methodology: 'comparative_market_analysis'
        },
        {
          date: new Date('2023-06-01'),
          value: 16500000,
          methodology: 'comparative_market_analysis'
        },
        {
          date: new Date('2023-12-01'),
          value: 18000000,
          methodology: 'comparative_market_analysis'
        }
      ]

      jest.spyOn(service, 'getValuationHistory').mockResolvedValue(mockHistory)

      const history = await service.getValuationHistory(propertyId)

      expect(history).toHaveLength(3)
      expect(history[0].value).toBeLessThan(history[2].value)
      expect(history.every(h => h.methodology)).toBe(true)
    })

    it('should return empty array for property with no history', async () => {
      const propertyId = 'new-property-id'
      
      jest.spyOn(service, 'getValuationHistory').mockResolvedValue([])

      const history = await service.getValuationHistory(propertyId)

      expect(history).toHaveLength(0)
    })
  })

  describe('calculateTokenPrice', () => {
    it('should calculate token price based on property valuation', async () => {
      const propertyValuation = 20000000 // 20M KES
      const totalTokens = 10000
      const expectedPricePerToken = 2000 // 2000 KES per token

      const tokenPrice = await service.calculateTokenPrice(propertyValuation, totalTokens)

      expect(tokenPrice).toBe(expectedPricePerToken)
    })

    it('should handle fractional token prices', async () => {
      const propertyValuation = 15500000 // 15.5M KES
      const totalTokens = 10000
      const expectedPricePerToken = 1550 // 1550 KES per token

      const tokenPrice = await service.calculateTokenPrice(propertyValuation, totalTokens)

      expect(tokenPrice).toBe(expectedPricePerToken)
    })

    it('should throw error for invalid inputs', async () => {
      await expect(service.calculateTokenPrice(0, 10000))
        .rejects.toThrow('Invalid property valuation')

      await expect(service.calculateTokenPrice(1000000, 0))
        .rejects.toThrow('Invalid total tokens')

      await expect(service.calculateTokenPrice(-1000000, 10000))
        .rejects.toThrow('Invalid property valuation')
    })
  })

  describe('getMarketTrends', () => {
    it('should return market trends for location', async () => {
      const location = 'Nairobi, Kenya'
      const mockTrends = {
        location,
        averagePricePerSqFt: 15000,
        priceGrowthRate: 0.08, // 8% annual growth
        marketActivity: 'high',
        inventory: 'low',
        trends: {
          '6months': 0.04,
          '1year': 0.08,
          '2years': 0.18
        }
      }

      jest.spyOn(service, 'getMarketTrends').mockResolvedValue(mockTrends)

      const trends = await service.getMarketTrends(location)

      expect(trends.location).toBe(location)
      expect(trends.averagePricePerSqFt).toBeGreaterThan(0)
      expect(trends.priceGrowthRate).toBeGreaterThan(0)
      expect(trends.trends).toHaveProperty('6months')
      expect(trends.trends).toHaveProperty('1year')
      expect(trends.trends).toHaveProperty('2years')
    })
  })

  describe('validateValuationData', () => {
    it('should validate complete property data', () => {
      const validData = {
        location: 'Nairobi, Kenya',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2020,
        condition: 'good'
      }

      expect(() => service.validateValuationData(validData)).not.toThrow()
    })

    it('should throw error for missing required fields', () => {
      const invalidData = {
        location: 'Nairobi, Kenya',
        propertyType: 'residential'
        // Missing size, bedrooms, etc.
      }

      expect(() => service.validateValuationData(invalidData))
        .toThrow('Missing required valuation data')
    })

    it('should throw error for invalid property type', () => {
      const invalidData = {
        location: 'Nairobi, Kenya',
        propertyType: 'invalid-type',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2020,
        condition: 'good'
      }

      expect(() => service.validateValuationData(invalidData))
        .toThrow('Invalid property type')
    })

    it('should throw error for invalid year built', () => {
      const invalidData = {
        location: 'Nairobi, Kenya',
        propertyType: 'residential',
        size: 1000,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2050, // Future year
        condition: 'good'
      }

      expect(() => service.validateValuationData(invalidData))
        .toThrow('Invalid year built')
    })
  })
})