import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface VersionedRequest extends Request {
  apiVersion?: string;
}

/**
 * API versioning middleware
 * Supports versioning via header, query parameter, or URL path
 */
export const apiVersionMiddleware = (req: VersionedRequest, res: Response, next: NextFunction): void => {
  // Check for version in header (preferred method)
  let version = req.headers['api-version'] as string;
  
  // Fallback to query parameter
  if (!version) {
    version = req.query.version as string;
  }
  
  // Fallback to URL path version (e.g., /api/v1/...)
  if (!version) {
    const pathMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)?)\//);
    if (pathMatch) {
      version = pathMatch[1];
    }
  }
  
  // Default to latest version if none specified
  if (!version) {
    version = '1.0';
  }
  
  // Validate version format
  if (!/^\d+\.\d+$/.test(version)) {
    res.status(400).json({
      success: false,
      error: 'Invalid API version format. Use format: x.y (e.g., 1.0, 1.1)'
    });
    return;
  }
  
  // Check if version is supported
  const supportedVersions = ['1.0'];
  if (!supportedVersions.includes(version)) {
    res.status(400).json({
      success: false,
      error: `API version ${version} is not supported. Supported versions: ${supportedVersions.join(', ')}`,
      supportedVersions
    });
    return;
  }
  
  // Add version to request object
  req.apiVersion = version;
  
  // Add version to response headers
  res.set('API-Version', version);
  res.set('Supported-Versions', supportedVersions.join(', '));
  
  logger.debug('API version set', { 
    version, 
    path: req.path, 
    method: req.method 
  });
  
  next();
};

/**
 * Deprecation warning middleware
 */
export const deprecationWarningMiddleware = (deprecatedVersion: string, message?: string) => {
  return (req: VersionedRequest, res: Response, next: NextFunction): void => {
    if (req.apiVersion === deprecatedVersion) {
      const warningMessage = message || `API version ${deprecatedVersion} is deprecated. Please upgrade to the latest version.`;
      
      res.set('Deprecation', 'true');
      res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()); // 90 days from now
      res.set('Warning', `299 - "${warningMessage}"`);
      
      logger.warn('Deprecated API version used', {
        version: deprecatedVersion,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
    }
    
    next();
  };
};

/**
 * Version-specific feature middleware
 */
export const versionFeatureMiddleware = (requiredVersion: string, feature: string) => {
  return (req: VersionedRequest, res: Response, next: NextFunction): void => {
    const currentVersion = req.apiVersion || '1.0';
    
    // Simple version comparison (assumes x.y format)
    const [currentMajor, currentMinor] = currentVersion.split('.').map(Number);
    const [requiredMajor, requiredMinor] = requiredVersion.split('.').map(Number);
    
    const isVersionSupported = 
      currentMajor > requiredMajor || 
      (currentMajor === requiredMajor && currentMinor >= requiredMinor);
    
    if (!isVersionSupported) {
      res.status(400).json({
        success: false,
        error: `Feature '${feature}' requires API version ${requiredVersion} or higher. Current version: ${currentVersion}`,
        requiredVersion,
        currentVersion
      });
      return;
    }
    
    next();
  };
};