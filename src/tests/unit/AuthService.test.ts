import { AuthService } from '../../services/AuthService';
import { UserModel } from '../../models/UserModel';
import { User } from '../../types/entities';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../models/UserModel');
jest.mock('jsonwebtoken');
jest.mock('../../utils/logger');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserModel: jest.Mocked<UserModel>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    kycStatus: 'pending',
    verificationLevel: 'basic',
    isAccreditedInvestor: false,
    emailVerified: false,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserModel = new UserModel() as jest.Mocked<UserModel>;
    authService = new AuthService();
    
    // Replace the private userModel instance
    (authService as any).userModel = mockUserModel;
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.createUser.mockResolvedValue(mockUser);
      mockUserModel.updateLastLogin.mockResolvedValue();

      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.register(registerData);

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(mockUserModel.createUser).toHaveBeenCalledWith(registerData);
      expect(mockUserModel.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toHaveProperty('accessToken', 'access-token');
      expect(result.tokens).toHaveProperty('refreshToken', 'refresh-token');
    });

    it('should throw error if user already exists', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockUserModel.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(registerData))
        .rejects.toThrow('User already exists with this email');

      expect(mockUserModel.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      mockUserModel.verifyPassword.mockResolvedValue(mockUser);
      mockUserModel.updateLastLogin.mockResolvedValue();

      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.login(credentials);

      expect(mockUserModel.verifyPassword).toHaveBeenCalledWith(
        credentials.email,
        credentials.password
      );
      expect(mockUserModel.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toHaveProperty('accessToken', 'access-token');
      expect(result.tokens).toHaveProperty('refreshToken', 'refresh-token');
    });

    it('should throw error for invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      mockUserModel.verifyPassword.mockResolvedValue(null);

      await expect(authService.login(credentials))
        .rejects.toThrow('Invalid email or password');

      expect(mockUserModel.updateLastLogin).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        kycStatus: mockUser.kycStatus,
        verificationLevel: mockUser.verificationLevel,
        roles: ['user']
      };

      (jwt.verify as jest.Mock).mockReturnValue(tokenPayload);
      mockUserModel.findById.mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshToken(refreshToken);

      expect(jwt.verify).toHaveBeenCalledWith(
        refreshToken,
        expect.any(String)
      );
      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
    });

    it('should throw error for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow('Invalid refresh token');

      expect(mockUserModel.findById).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenPayload = {
        userId: 'non-existent-user',
        email: 'test@example.com',
        kycStatus: 'pending',
        verificationLevel: 'basic',
        roles: ['user']
      };

      (jwt.verify as jest.Mock).mockReturnValue(tokenPayload);
      mockUserModel.findById.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('verifyToken', () => {
    it('should verify token successfully', async () => {
      const accessToken = 'valid-access-token';
      const tokenPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        kycStatus: mockUser.kycStatus,
        verificationLevel: mockUser.verificationLevel,
        roles: ['user']
      };

      (jwt.verify as jest.Mock).mockReturnValue(tokenPayload);
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await authService.verifyToken(accessToken);

      expect(jwt.verify).toHaveBeenCalledWith(
        accessToken,
        expect.any(String)
      );
      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid access token', async () => {
      const accessToken = 'invalid-access-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyToken(accessToken))
        .rejects.toThrow('Invalid access token');

      expect(mockUserModel.findById).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = mockUser.id;
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword123!';

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.verifyPassword.mockResolvedValue(mockUser);
      mockUserModel.updatePassword.mockResolvedValue();

      await authService.changePassword(userId, currentPassword, newPassword);

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.verifyPassword).toHaveBeenCalledWith(
        mockUser.email,
        currentPassword
      );
      expect(mockUserModel.updatePassword).toHaveBeenCalledWith(
        userId,
        newPassword
      );
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent-user';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword123!';

      mockUserModel.findById.mockResolvedValue(null);

      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('User not found');

      expect(mockUserModel.verifyPassword).not.toHaveBeenCalled();
      expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw error if current password is incorrect', async () => {
      const userId = mockUser.id;
      const currentPassword = 'WrongPassword123!';
      const newPassword = 'NewPassword123!';

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.verifyPassword.mockResolvedValue(null);

      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('Current password is incorrect');

      expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token for existing user', async () => {
      const email = 'test@example.com';

      mockUserModel.findByEmail.mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue('reset-token');

      await authService.requestPasswordReset(email);

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith(email);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: mockUser.id, purpose: 'password_reset' },
        expect.any(String),
        { expiresIn: '1h' }
      );
    });

    it('should not throw error for non-existent user', async () => {
      const email = 'nonexistent@example.com';

      mockUserModel.findByEmail.mockResolvedValue(null);

      await expect(authService.requestPasswordReset(email))
        .resolves.not.toThrow();

      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const resetToken = 'valid-reset-token';
      const newPassword = 'NewPassword123!';
      const tokenPayload = {
        userId: mockUser.id,
        purpose: 'password_reset'
      };

      (jwt.verify as jest.Mock).mockReturnValue(tokenPayload);
      mockUserModel.updatePassword.mockResolvedValue();

      await authService.resetPassword(resetToken, newPassword);

      expect(jwt.verify).toHaveBeenCalledWith(
        resetToken,
        expect.any(String)
      );
      expect(mockUserModel.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        newPassword
      );
    });

    it('should throw error for invalid reset token', async () => {
      const resetToken = 'invalid-reset-token';
      const newPassword = 'NewPassword123!';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.resetPassword(resetToken, newPassword))
        .rejects.toThrow('Invalid or expired reset token');

      expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw error for token with wrong purpose', async () => {
      const resetToken = 'valid-token-wrong-purpose';
      const newPassword = 'NewPassword123!';
      const tokenPayload = {
        userId: mockUser.id,
        purpose: 'email_verification'
      };

      (jwt.verify as jest.Mock).mockReturnValue(tokenPayload);

      await expect(authService.resetPassword(resetToken, newPassword))
        .rejects.toThrow('Invalid or expired reset token');

      expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
    });
  });
});