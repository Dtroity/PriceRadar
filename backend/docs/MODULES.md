# ProcureAI modular architecture (Phase 3.2)

## Layout

```
src/modules/
  _shared/           requireModule.ts, subscriptionRepository.ts
  price-monitoring/  routes, service, repository, worker, types
  invoice-ai/
  forecast/
  foodcost/
  supplier-intelligence/
  order-automation/  AZbot → supplier orders, filters, contacts, send queue
  ai-procurement-agent/
  integrations/
  registry.ts        mountModuleRoutes(apiRouter)
```

## SaaS

1. Run `npm run db:migrate:phase32` after `db:migrate:procureai`.
2. Table `modules` lists module keys; `plan_modules` enables per plan; `organization_subscriptions` assigns plan.
3. Middleware `requireModule('order_automation')` → 403 if plan does not include module.

## API (examples)

| Module | Base path |
|--------|-----------|
| Order automation | `/api/order-automation/orders`, `/filters`, `/automation-rules` |
| AI procurement | `POST /api/procurement/recommendations` |
| Status stubs | `/api/modules/price-monitoring/status`, … |

## AZbot

Legacy Python app under `/AZbot` — logic ported to `order-automation` (filters → `supplier_order_filters`, bulk lines → orders). See `AZbot/README.md`.
