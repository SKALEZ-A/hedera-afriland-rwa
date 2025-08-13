// Export all models
export { BaseModel } from './BaseModel';
export { UserModel } from './UserModel';
export { PropertyModel } from './PropertyModel';
export { InvestmentModel } from './InvestmentModel';
export { TransactionModel } from './TransactionModel';

// Create model instances for easy import
export const userModel = new UserModel();
export const propertyModel = new PropertyModel();
export const investmentModel = new InvestmentModel();
export const transactionModel = new TransactionModel();