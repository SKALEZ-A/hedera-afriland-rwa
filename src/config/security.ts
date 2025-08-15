import { BackupConfig } from '../services/BackupService';

export interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    tagLength: number;
    saltRounds: number;
  };
  rateLimit: {
    general: {
      windowMs: number;
      max: number;
    };
    auth: {
      windowMs: number;
      max: number;
    };
    api: {
      windowMs: number;
      max: number;
    };
    investment: {
      windowMs: number;
      max: number;
    };
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  headers: {
    contentSecurityPolicy: {
      directives: Record<string, string[]>;
    };
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };
  backup: BackupConfig;
  audit: {
    retentionDays: number;
    encryptSensitiveData: boolean;
    logAllRequests: boolean;
    logFailedAttempts: boolean;
  };
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // days
    preventReuse: number; // number of previous passwords
  };
  session: {
    maxAge: number; // milliseconds
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  bruteForce: {
    maxAttempts: number;
    lockoutDuration: number; // minutes
    progressiveDelay: boolean;
  };
}

export const securityConfig: SecurityConfig = {
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    saltRounds: 12
  },
  rateLimit: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5
    },
    api: {
      windowMs: 60 * 1000, // 1 minute
      max: 60
    },
    investment: {
      windowMs: 60 * 1000, // 1 minute
      max: 10
    }
  },
  cors: {
    allowedOrigins: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_URL || 'http://localhost:3001',
      'https://globalland.app',
      'https://admin.globalland.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ]
  },
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "https:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  },
  backup: {
    schedule: '0 2 * * *', // Daily at 2 AM
    retentionDays: 30,
    encryptBackups: true,
    uploadToCloud: process.env.NODE_ENV === 'production',
    cloudProvider: 'aws',
    notifyOnFailure: true
  },
  audit: {
    retentionDays: 2555, // 7 years for compliance
    encryptSensitiveData: true,
    logAllRequests: false, // Only security-relevant requests
    logFailedAttempts: true
  },
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // 90 days
    preventReuse: 5 // Last 5 passwords
  },
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  },
  bruteForce: {
    maxAttempts: 5,
    lockoutDuration: 15, // 15 minutes
    progressiveDelay: true
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  securityConfig.cors.allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
  securityConfig.session.secure = false;
  securityConfig.backup.uploadToCloud = false;
}

if (process.env.NODE_ENV === 'test') {
  securityConfig.rateLimit.general.max = 1000;
  securityConfig.rateLimit.auth.max = 100;
  securityConfig.backup.uploadToCloud = false;
  securityConfig.audit.logAllRequests = false;
}

export default securityConfig;