import { verifyAccessToken } from './jwt.js';
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7);
    try {
        const payload = verifyAccessToken(token);
        req.user = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            organizationId: payload.organizationId,
        };
        console.log(`[auth] ${req.method} ${req.originalUrl} user=${req.user.userId} role=${req.user.role} org=${req.user.organizationId ?? 'none'}`);
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
export function requireRole(...rolesOrArray) {
    const roles = rolesOrArray.flatMap((r) => (Array.isArray(r) ? r : [r]));
    const middleware = (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        console.log(`[rbac] ${req.method} ${req.originalUrl} user=${req.user.userId} role=${req.user.role} required=${roles.join(',')}`);
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
    middleware.requiredRoles = roles;
    return middleware;
}
