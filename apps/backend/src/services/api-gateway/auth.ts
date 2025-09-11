import { Router } from 'express';
import { db, transformUserToApi } from '../../shared/database';
import { AuthService, requireAuth } from '../../shared/utils/auth';
import { validate, loginSchema, registerSchema } from '../../shared/utils/validation';
import { logger } from '../../shared/utils/logger';
import type { LoginRequest, RegisterRequest, AuthResponse } from '../../shared/types';

const router = Router();

// Register new user and organization
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name, orgName }: RegisterRequest = req.validated;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        code: 'USER_EXISTS',
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await AuthService.hashPassword(password);

    // Create organization and user in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create organization
      const org = await tx.organization.create({
        data: {
          name: orgName,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          orgId: org.id,
          role: 'ADMIN', // First user is admin
        },
        include: {
          organization: true,
        },
      });

      // Create default project
      await tx.project.create({
        data: {
          name: 'Default Project',
          description: 'Your first project',
          orgId: org.id,
        },
      });

      return user;
    });

    // Generate tokens
    const apiUser = transformUserToApi(result);
    const tokens = AuthService.generateTokens(apiUser);

    const response: AuthResponse = {
      user: apiUser,
      tokens,
    };

    logger.info('User registered successfully', { 
      userId: result.id, 
      email: result.email,
      orgId: result.orgId 
    });

    res.status(201).json(response);
  } catch (error) {
    logger.error('Registration error', { error, email: req.validated?.email });
    res.status(500).json({
      code: 'REGISTRATION_FAILED',
      message: 'Failed to register user',
    });
  }
});

// Login user
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password }: LoginRequest = req.validated;

    // Find user with organization
    const user = await db.user.findUnique({
      where: { email },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isValidPassword = await AuthService.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Generate tokens
    const apiUser = transformUserToApi(user);
    const tokens = AuthService.generateTokens(apiUser);

    const response: AuthResponse = {
      user: apiUser,
      tokens,
    };

    logger.info('User logged in successfully', { 
      userId: user.id, 
      email: user.email 
    });

    res.json(response);
  } catch (error) {
    logger.error('Login error', { error, email: req.validated?.email });
    res.status(500).json({
      code: 'LOGIN_FAILED',
      message: 'Failed to login user',
    });
  }
});

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.userId },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const apiUser = transformUserToApi(user);
    res.json({ user: apiUser });
  } catch (error) {
    logger.error('Get user profile error', { error, userId: req.user?.userId });
    res.status(500).json({
      code: 'PROFILE_FETCH_FAILED',
      message: 'Failed to fetch user profile',
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const payload = AuthService.verifyToken(refreshToken);

    // Find user
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Generate new tokens
    const apiUser = transformUserToApi(user);
    const tokens = AuthService.generateTokens(apiUser);

    res.json({ tokens });
  } catch (error) {
    logger.error('Token refresh error', { error });
    res.status(401).json({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Invalid or expired refresh token',
    });
  }
});

// Logout (client-side token invalidation)
router.post('/logout', requireAuth, (req, res) => {
  logger.info('User logged out', { userId: req.user.userId });
  res.json({ message: 'Logged out successfully' });
});

export default router;