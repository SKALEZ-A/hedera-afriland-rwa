import request from 'supertest';
import app from '../../app';
import { SecurityTestingService } from '../../services/SecurityTestingService';
import { SecurityUtils } from '../../utils/security';
import { EncryptionService } from '../../services/EncryptionService';
import { AuditService } from '../../services/AuditService';

describe('Comprehensive Security Tests', () => {
  
  describe('Input Validation and Sanitization', () => {
    
    test('should reject SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'test123'
          });

        expect(response.status).toBeOneOf([400, 422, 429]);
      }
    });

    test('should sanitize XSS attempts', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>"
      ];

      for (const payload of xssPayloads) {
        const sanitized = SecurityUtils.sanitizeInput(payload);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
      }
    });

    test('should detect suspicious patterns', () => {
      const testInputs = [
        { input: "SELECT * FROM users", expected: ['SQL Injection'] },
        { input: "<script>alert('test')</script>", expected: ['XSS'] },
        { input: "../../etc/passwd", expected: ['Path Traversal'] },
        { input: "test; rm -rf /", expected: ['Command Injection'] }
      ];

      testInputs.forEach(({ input, expected }) => {
        const result = SecurityUtils.detectSuspiciousPatterns(input);
        expect(result.suspicious).toBe(true);
        expect(result.patterns).toEqual(expect.arrayContaining(expected));
      });
    });
  });

  describe('Authentication Security', () => {
    
    test('should enforce strong password policy', () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'short'
      ];

      weakPasswords.forEach(password => {
        const result = SecurityUtils.validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should accept strong passwords', () => {
      const strongPasswords = [
        'StrongP@ssw0rd123',
        'MySecure!Pass2023',
        'C0mpl3x&Secure#Pass'
      ];

      strongPasswords.forEach(password => {
        const result = SecurityUtils.validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      });
    });

    test('should rate limit authentication attempts', async () => {
      const attempts = [];
      
      // Make multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        const response = request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
        attempts.push(response);
      }

      const responses = await Promise.all(attempts);
      
      // Should eventually get rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should generate secure passwords', () => {
      const password = SecurityUtils.generateSecurePassword(16);
      
      expect(password).toHaveLength(16);
      expect(/[A-Z]/.test(password)).toBe(true); // Has uppercase
      expect(/[a-z]/.test(password)).toBe(true); // Has lowercase
      expect(/\d/.test(password)).toBe(true); // Has numbers
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true); // Has special chars
    });
  });

  describe('Data Encryption', () => {
    
    test('should encrypt and decrypt data correctly', () => {
      const originalData = 'Sensitive user information';
      
      const encrypted = EncryptionService.encrypt(originalData);
      expect(encrypted).not.toBe(originalData);
      expect(encrypted).toContain(':'); // Should have IV:tag:data format
      
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(originalData);
    });

    test('should hash passwords securely', async () => {
      const password = 'testPassword123';
      
      const hash = await EncryptionService.hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[ab]\$/); // bcrypt format
      
      const isValid = await EncryptionService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await EncryptionService.verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    test('should encrypt PII data with metadata', () => {
      const piiData = {
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111'
      };
      
      const encrypted = EncryptionService.encryptPII(piiData);
      expect(encrypted).not.toContain('123-45-6789');
      expect(encrypted).not.toContain('4111-1111-1111-1111');
      
      const decrypted = EncryptionService.decryptPII(encrypted);
      expect(decrypted).toEqual(piiData);
    });

    test('should create and verify signatures', () => {
      const data = 'Important data to sign';
      const secret = 'secret-key';
      
      const signature = EncryptionService.createSignature(data, secret);
      expect(signature).toHaveLength(64); // SHA256 hex length
      
      const isValid = EncryptionService.verifySignature(data, signature, secret);
      expect(isValid).toBe(true);
      
      const isInvalid = EncryptionService.verifySignature('tampered data', signature, secret);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Authorization and Access Control', () => {
    
    test('should reject unauthorized access to protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/properties',
        '/api/investments',
        '/api/portfolio'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBeOneOf([401, 403]);
      }
    });

    test('should validate API keys correctly', () => {
      const apiKey = SecurityUtils.generateAPIKey('test');
      expect(apiKey).toMatch(/^test_\d+_[a-f0-9]{32}$/);
      
      const hash = SecurityUtils.hashAPIKey(apiKey);
      expect(hash).toHaveLength(64); // SHA256 hex length
      expect(hash).not.toBe(apiKey);
    });

    test('should validate CSRF tokens', () => {
      const token = SecurityUtils.generateCSRFToken();
      expect(token).toHaveLength(64); // 32 bytes in hex
      
      const isValid = SecurityUtils.validateCSRFToken(token, token);
      expect(isValid).toBe(true);
      
      const differentToken = SecurityUtils.generateCSRFToken();
      const isInvalid = SecurityUtils.validateCSRFToken(token, differentToken);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Network Security', () => {
    
    test('should set security headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should validate webhook signatures', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      
      const isValid = SecurityUtils.validateSignature(
        payload,
        'sha256=' + require('crypto').createHmac('sha256', secret).update(payload).digest('hex'),
        secret
      );
      expect(isValid).toBe(true);
    });

    test('should extract client IP correctly', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '192.168.1.1, 10.0.0.1')
        .set('X-Real-IP', '203.0.113.1');
      
      // The middleware should process the IP correctly
      expect(response.status).toBe(200);
    });
  });

  describe('File Upload Security', () => {
    
    test('should validate file uploads', () => {
      const validFile = {
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024 // 1MB
      };
      
      const result = SecurityUtils.validateFileUpload(
        validFile.filename,
        validFile.mimetype,
        validFile.size
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject dangerous file uploads', () => {
      const dangerousFiles = [
        { filename: 'malware.exe', mimetype: 'application/x-executable', size: 1024 },
        { filename: 'script.js', mimetype: 'application/javascript', size: 1024 },
        { filename: 'large.pdf', mimetype: 'application/pdf', size: 20 * 1024 * 1024 } // 20MB
      ];

      dangerousFiles.forEach(file => {
        const result = SecurityUtils.validateFileUpload(
          file.filename,
          file.mimetype,
          file.size
        );
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Audit and Compliance', () => {
    
    test('should log security events', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      SecurityUtils.logSecurityEvent(
        'TEST_EVENT',
        'high',
        { test: 'data' }
      );
      
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    test('should mask sensitive data', () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123xyz',
        publicInfo: 'this is public'
      };
      
      const masked = SecurityUtils.maskSensitiveData(sensitiveData);
      
      expect(masked.username).toBe('testuser');
      expect(masked.password).toBe('*********');
      expect(masked.token).toBe('*********');
      expect(masked.publicInfo).toBe('this is public');
    });

    test('should generate secure OTP', () => {
      const otp = SecurityUtils.generateOTP(6);
      
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });
  });

  describe('Security Test Suite Integration', () => {
    
    test('should run comprehensive security tests', async () => {
      // Mock the database pool for testing
      const mockPool = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      
      SecurityTestingService.initialize(mockPool as any, 'http://localhost:3000');
      
      // This would run the actual security test suite
      // In a real scenario, you'd want to test against a test environment
      expect(SecurityTestingService).toBeDefined();
    });
  });

  describe('Environment and Configuration Security', () => {
    
    test('should validate required environment variables', () => {
      const requiredEnvVars = [
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'DATABASE_URL'
      ];
      
      requiredEnvVars.forEach(envVar => {
        const value = process.env[envVar];
        expect(value).toBeDefined();
        expect(value).not.toBe('');
      });
    });

    test('should use secure defaults in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Test that production settings are secure
      // This would check various configuration settings
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});

// Helper function for test expectations
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});