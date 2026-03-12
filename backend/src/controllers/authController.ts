import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as usersModel from '../models/users.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import type { AuthRequest } from '../auth/middleware.js';
import type { UserRole } from '../types/index.js';

export async function register(req: Request, res: Response) {
  try {
    const { email, password, role = 'viewer' } = req.body as {
      email?: string;
      password?: string;
      role?: UserRole;
    };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const existing = await usersModel.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const user = await usersModel.createUser(email, password, role);
    const accessToken = signAccessToken(user.id, user.email, user.role);
    const refreshToken = signRefreshToken(user.id, user.email, user.role);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await usersModel.saveRefreshToken(user.id, tokenHash, expiresAt);
    return res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
      expiresIn: 900,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await usersModel.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const accessToken = signAccessToken(user.id, user.email, user.role);
    const refreshToken = signRefreshToken(user.id, user.email, user.role);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await usersModel.saveRefreshToken(user.id, tokenHash, expiresAt);
    return res.json({
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
      expiresIn: 900,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const valid = await usersModel.findRefreshToken(payload.userId, tokenHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const user = await usersModel.findUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const accessToken = signAccessToken(user.id, user.email, user.role);
    return res.json({ accessToken, expiresIn: 900 });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (req.user?.userId && refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await usersModel.deleteRefreshToken(req.user.userId, tokenHash);
    }
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: true });
  }
}

export async function me(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await usersModel.findUserById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
}
