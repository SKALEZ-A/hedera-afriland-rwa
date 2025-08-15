
import { HederaService } from './HederaService';
import { PropertyTokenizationService } from './PropertyTokenizationService';
import { PropertyService } from './PropertyService';
import { PropertyDocumentService } from './PropertyDocumentService';
import { PropertyValuationService } from './PropertyValuationService';
import { InvestmentService } from './InvestmentService';

// Export all services
export { HederaService } from './HederaService';
export { PropertyTokenizationService } from './PropertyTokenizationService';
export { PropertyService } from './PropertyService';
export { PropertyDocumentService } from './PropertyDocumentService';
export { PropertyValuationService } from './PropertyValuationService';
export { InvestmentService } from './InvestmentService';

// Create service instances for easy import
export const hederaService = new (require("./HederaService").HederaService)();
export const propertyTokenizationService = new (require("./PropertyTokenizationService").PropertyTokenizationService)();
export const propertyService = new (require("./PropertyService").PropertyService)();
export const propertyDocumentService = new (require("./PropertyDocumentService").PropertyDocumentService)();
export const propertyValuationService = new (require("./PropertyValuationService").PropertyValuationService)();
export const investmentService = new (require("./InvestmentService").InvestmentService)();