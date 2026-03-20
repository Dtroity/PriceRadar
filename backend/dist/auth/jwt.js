import jwt from 'jsonwebtoken';
import { config } from '../config.js';
export function signAccessToken(userId, email, role, organizationId) {
    const payload = { userId, email, role, type: 'access' };
    if (organizationId)
        payload.organizationId = organizationId;
    return jwt.sign(payload, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiresIn,
    });
}
export function signRefreshToken(userId, email, role, organizationId) {
    const payload = { userId, email, role, type: 'refresh' };
    if (organizationId)
        payload.organizationId = organizationId;
    return jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn,
    });
}
export function verifyAccessToken(token) {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    if (decoded.type !== 'access')
        throw new Error('Invalid token type');
    return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        type: 'access',
        organizationId: decoded.organizationId,
    };
}
export function verifyRefreshToken(token) {
    const decoded = jwt.verify(token, config.jwt.refreshSecret);
    if (decoded.type !== 'refresh')
        throw new Error('Invalid token type');
    return decoded;
}
