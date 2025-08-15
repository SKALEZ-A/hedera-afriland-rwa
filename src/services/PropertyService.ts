import { logger } from '../utils/logger';
import { PropertyModel } from '../models/PropertyModel';
import { Property } from '../types/entities';

export class PropertyService {
  private propertyModel: typeof PropertyModel;

  constructor() {
    this.propertyModel = PropertyModel;
  }

  /**
   * Create a new property
   */
  async createProperty(propertyData: Partial<Property>): Promise<Property> {
    try {
      logger.info('Creating new property', { name: propertyData.name });
      
      const property = await this.propertyModel.create(propertyData);
      
      logger.info('Property created successfully', { id: property.id });
      return property;

    } catch (error) {
      logger.error('Error creating property:', error);
      throw error;
    }
  }

  /**
   * Get property by ID
   */
  async getPropertyById(id: string): Promise<Property | null> {
    try {
      return await this.propertyModel.findById(id);
    } catch (error) {
      logger.error('Error getting property by ID:', error);
      throw error;
    }
  }

  /**
   * Get all properties
   */
  async getAllProperties(): Promise<Property[]> {
    try {
      return await this.propertyModel.findAll();
    } catch (error) {
      logger.error('Error getting all properties:', error);
      throw error;
    }
  }

  /**
   * Update property
   */
  async updateProperty(id: string, updates: Partial<Property>): Promise<Property> {
    try {
      logger.info('Updating property', { id });
      
      const property = await this.propertyModel.update(id, updates);
      
      logger.info('Property updated successfully', { id });
      return property;

    } catch (error) {
      logger.error('Error updating property:', error);
      throw error;
    }
  }

  /**
   * Delete property
   */
  async deleteProperty(id: string): Promise<void> {
    try {
      logger.info('Deleting property', { id });
      
      await this.propertyModel.delete(id);
      
      logger.info('Property deleted successfully', { id });

    } catch (error) {
      logger.error('Error deleting property:', error);
      throw error;
    }
  }

  /**
   * Search properties
   */
  async searchProperties(criteria: any): Promise<Property[]> {
    try {
      logger.info('Searching properties', criteria);
      
      // This would implement actual search logic
      const properties = await this.propertyModel.findAll();
      
      return properties;

    } catch (error) {
      logger.error('Error searching properties:', error);
      throw error;
    }
  }

  /**
   * Get properties by manager ID
   */
  async getPropertiesByManagerId(managerId: string): Promise<Property[]> {
    try {
      return await this.propertyModel.findByManagerId(managerId);
    } catch (error) {
      logger.error('Error getting properties by manager ID:', error);
      throw error;
    }
  }

  /**
   * Record rental income for a property
   */
  async recordRentalIncome(propertyId: string, incomeData: {
    amount: number;
    period: string;
    description?: string;
    recordedBy: string;
    recordedAt: Date;
  }): Promise<void> {
    try {
      const incomeRecord = await this.propertyModel.recordRentalIncome(propertyId, incomeData);
      
      logger.info(`Rental income recorded for property ${propertyId}:`, {
        amount: incomeData.amount,
        period: incomeData.period
      });

    } catch (error) {
      logger.error('Error recording rental income:', error);
      throw error;
    }
  }
}