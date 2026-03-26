import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as usersModel from '../models/users.js';
import * as usersMt from '../models/users-mt.js';
import * as orgModel from '../models/organizations.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import * as orgModules from '../models/organizationModulesModel.js';
function getUsersModel(payload) {
    if (config.multiTenant && payload?.organizationId)
        return usersMt;
    return usersModel;
}
export async function register(req, res) {
    try {
        if (config.multiTenant) {
            return res.status(400).json({ error: 'Use /auth/register-org (workspace slug required)' });
        }
        const { email, password, role = 'manager' } = req.body;
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
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Registration failed' });
    }
}
export async function login(req, res) {
    try {
        if (config.multiTenant) {
            return res.status(400).json({ error: 'Use /auth/login-org (workspace slug required)' });
        }
        const { email, password } = req.body;
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
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Login failed' });
    }
}
export async function refresh(req, res) {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        const payload = verifyRefreshToken(refreshToken);
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const users = getUsersModel(payload);
        const valid = await users.findRefreshToken(payload.userId, tokenHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        const user = await users.findUserById(payload.userId);
        if (!user)
            return res.status(401).json({ error: 'User not found' });
        const accessToken = signAccessToken(user.id, user.email, user.role, 'organization_id' in user ? user.organization_id : undefined);
        return res.json({ accessToken, expiresIn: 900 });
    }
    catch {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
}
export async function logout(req, res) {
    try {
        const { refreshToken } = req.body;
        if (req.user?.userId && refreshToken) {
            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            await getUsersModel({ organizationId: req.user.organizationId }).deleteRefreshToken(req.user.userId, tokenHash);
        }
        return res.json({ ok: true });
    }
    catch {
        return res.json({ ok: true });
    }
}
export async function me(req, res) {
    if (!req.user)
        return res.status(401).json({ error: 'Unauthorized' });
    const user = config.multiTenant && req.user.organizationId
        ? await usersMt.findUserById(req.user.userId)
        : await usersModel.findUserById(req.user.userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
}
// --- Multi-tenant (ProcureAI) ---
export async function registerOrg(req, res) {
    try {
        const { organizationName, slug, email, password, industry } = req.body;
        if (!organizationName || !slug || !email || !password) {
            return res.status(400).json({ error: 'organizationName, slug, email and password required' });
        }
        const existingOrg = await orgModel.findBySlug(slug);
        if (existingOrg) {
            return res.status(409).json({ error: 'Organization slug already taken' });
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const s = slug
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            const { rows: orgRows } = await client.query(`INSERT INTO organizations (name, slug, plan, industry)
         VALUES ($1, $2, 'free', $3)
         RETURNING id, name, slug, created_at`, [organizationName, s || 'org', industry ?? null]);
            const org = orgRows[0];
            await orgModules.seedModulesForOrganization(org.id, 'free', client);
            const password_hash = await bcrypt.hash(password, 10);
            const { rows: userRows } = await client.query(`INSERT INTO users (organization_id, email, password_hash, role)
         VALUES ($1::uuid, $2, $3, 'org_admin')
         RETURNING id, organization_id, email, role, created_at`, [org.id, email, password_hash]);
            const user = userRows[0];
            await client.query('COMMIT');
            const accessToken = signAccessToken(user.id, user.email, user.role, org.id);
            const refreshToken = signRefreshToken(user.id, user.email, user.role, org.id);
            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await usersMt.saveRefreshToken(user.id, tokenHash, expiresAt);
            return res.status(201).json({
                organization: { id: org.id, name: org.name, slug: org.slug },
                user: { id: user.id, organization_id: user.organization_id, email: user.email, role: user.role },
                accessToken,
                refreshToken,
                expiresIn: 900,
            });
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Registration failed' });
    }
}
export async function loginWithOrg(req, res) {
    try {
        const { email, password, organizationSlug } = req.body;
        if (!email || !password || !organizationSlug) {
            return res.status(400).json({ error: 'email, password and organizationSlug required' });
        }
        const org = await orgModel.findBySlug(organizationSlug);
        if (!org) {
            return res.status(401).json({ error: 'Invalid organization or credentials' });
        }
        const user = await usersMt.findUserByEmailAndOrg(org.id, email);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const accessToken = signAccessToken(user.id, user.email, user.role, org.id);
        const refreshToken = signRefreshToken(user.id, user.email, user.role, org.id);
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await usersMt.saveRefreshToken(user.id, tokenHash, expiresAt);
        return res.json({
            organization: { id: org.id, name: org.name, slug: org.slug },
            user: { id: user.id, organization_id: user.organization_id, email: user.email, role: user.role },
            accessToken,
            refreshToken,
            expiresIn: 900,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Login failed' });
    }
}
