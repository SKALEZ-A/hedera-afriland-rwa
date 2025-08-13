// Export all services
export { HederaService } from './HederaService';
export { PropertyTokenizationService } from './PropertyTokenizationService';
export { PropertyService } from './PropertyService';
export { PropertyDocumentService } from './PropertyDocumentService';
export { PropertyValuationService } from './PropertyValuationService';
export { InvestmentService } from './InvestmentService';

// Create service instances for easy import
export const hederaService = new HederaService();
export const propertyTokenizationService = new PropertyTokenizationService();
export const propertyService = new PropertyService();
export const propertyDocumentService = new PropertyDocumentService();
export const propertyValuationService = new PropertyValuationService();
export const investmentService = new InvestmentService();