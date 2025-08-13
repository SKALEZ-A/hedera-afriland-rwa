import { Router } from 'express';
import { PropertyController, upload } from '../controllers/PropertyController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const propertyController = new PropertyController();

// Property management routes
router.post('/register',
  authMiddleware.authenticate,
  authMiddleware.requireKYC,
  authMiddleware.requireRoles(['admin', 'property_manager']),
  propertyController.registerProperty
);

router.get('/search',
  propertyController.searchProperties
);

router.get('/statistics',
  authMiddleware.authenticate,
  authMiddleware.requireRoles(['admin']),
  propertyController.getPropertyStatistics
);

router.get('/:propertyId',
  propertyController.getProperty
);

router.put('/:propertyId/status',
  authMiddleware.authenticate,
  authMiddleware.requireKYC,
  authMiddleware.requireRoles(['admin', 'property_manager']),
  propertyController.updatePropertyStatus
);

router.put('/:propertyId/valuation',
  authMiddleware.authenticate,
  authMiddleware.requireKYC,
  authMiddleware.requireRoles(['admin', 'property_manager']),
  propertyController.updatePropertyValuation
);

router.get('/:propertyId/performance',
  authMiddleware.authenticate,
  propertyController.getPropertyPerformance
);

// Tokenization routes
router.post('/:propertyId/tokenize',
  authMiddleware.authenticate,
  authMiddleware.requireKYC,
  authMiddleware.requireRoles(['admin', 'property_manager']),
  authMiddleware.rateLimitAuth(3, 60 * 60 * 1000), // 3 attempts per hour
  propertyController.initiateTokenization
);

// Document management routes
router.post('/:propertyId/documents',
  authMiddleware.authenticate,
  authMiddleware.requireKYC,
  authMiddleware.requireRoles(['admin', 'property_manager']),
  upload.array('documents', 10), // Allow up to 10 documents per upload
  propertyController.uploadDocuments
);

router.get('/:propertyId/documents',
  authMiddleware.authenticate,
  propertyController.getPropertyDocuments
);

router.get('/documents/:documentId/download',
  authMiddleware.authenticate,
  propertyController.getDocumentDownloadUrl
);

router.put('/documents/:documentId/verification',
  authMiddleware.authenticate,
  authMiddleware.requireRoles(['admin']),
  propertyController.updateDocumentVerification
);

router.delete('/documents/:documentId',
  authMiddleware.authenticate,
  authMiddleware.requireRoles(['admin', 'property_manager']),
  propertyController.deleteDocument
);

export default router;