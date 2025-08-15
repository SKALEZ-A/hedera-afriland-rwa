import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    title: 'GlobalLand RWA Platform API',
    version: '1.0.0',
    description: 'Real Estate Tokenization Platform built on Hedera Hashgraph',
    endpoints: {
      health: {
        path: '/api/health',
        method: 'GET',
        description: 'Health check endpoint'
      },
      docs: {
        path: '/api/docs',
        method: 'GET', 
        description: 'API documentation'
      }
    },
    features: [
      'Property tokenization',
      'Investment management',
      'Trading platform',
      'Dividend distribution',
      'KYC/AML compliance',
      'Real-time notifications'
    ]
  });
}