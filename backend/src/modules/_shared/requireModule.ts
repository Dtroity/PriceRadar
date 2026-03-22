import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../auth/middleware.js';
import { organizationHasModule } from './subscriptionRepository.js';

export function requireModule(moduleKey: string) {
  const middleware = async (req: Request, res: Response, next: NextFunction) => {
    const auth = req as AuthRequest;
    const orgId = auth.user?.organizationId;
    if (auth.user?.role === 'super_admin') {
      return next();
    }
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const ok = await organizationHasModule(orgId, moduleKey);
      if (!ok) {
        return res.status(403).json({
          error: 'Module not available',
          module: moduleKey,
          upgrade_hint: 'Обратитесь к администратору для подключения модуля',
        });
      }
      next();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Subscription check failed' });
    }
  };
  (middleware as unknown as { requiredModule: string }).requiredModule = moduleKey;
  return middleware;
}
