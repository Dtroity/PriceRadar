import * as productsModel from '../models/products.js';
import * as productNameAliasesModel from '../models/productNameAliases.js';
import * as productAuditLog from '../models/productAuditLog.js';
import { normalizeProductName } from '../product-matching/normalizeRules.js';
import { logger } from '../utils/logger.js';
import { DUPLICATE_SIMILARITY_AUTO, DUPLICATE_SIMILARITY_SUGGEST, } from '../config/constants.js';
import { findDuplicatePairs, runAutoMergeDuplicates, } from '../services/duplicateDetector.js';
export async function list(req, res) {
    try {
        const orgId = req.user?.organizationId;
        const products = await productsModel.getAllProducts(orgId);
        return res.json({ products });
    }
    catch (err) {
        logger.error({ err }, 'Failed to fetch products');
        return res.status(500).json({ error: 'Failed to fetch products' });
    }
}
export async function setPriority(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'organization required' });
        const { id } = req.params;
        const { isPriority } = req.body;
        await productsModel.setProductPriorityWithAudit(id, Boolean(isPriority), orgId, req.user?.userId ?? null);
        return res.json({ ok: true });
    }
    catch (err) {
        const status = err.status;
        if (status === 404)
            return res.status(404).json({ error: 'Product not found' });
        logger.error({ err }, 'Failed to update product');
        return res.status(500).json({ error: 'Failed to update product' });
    }
}
export async function listNormalizationCandidates(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'organization required' });
        const aliases = await productNameAliasesModel.listForModeration(orgId);
        const unclear = aliases.filter((a) => a.raw_name !== a.normalized_name || a.usage_count > 1);
        return res.json({ items: unclear });
    }
    catch (err) {
        logger.error({ err }, 'Failed to fetch normalization candidates');
        return res.status(500).json({ error: 'Failed to fetch normalization candidates' });
    }
}
export async function mergeProducts(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'organization required' });
        const { sourceProductIds, targetProductId } = req.body;
        const uniqueSources = [...new Set(sourceProductIds)];
        if (uniqueSources.includes(targetProductId)) {
            return res.status(400).json({ error: 'Cannot merge: target must not be in sourceProductIds' });
        }
        const result = await productsModel.mergeProducts({
            organizationId: orgId,
            targetProductId,
            sourceProductIds: uniqueSources,
            actorUserId: req.user?.userId ?? null,
        });
        logger.info({
            event: 'products_merge',
            userId: req.user?.userId,
            email: req.user?.email,
            organizationId: orgId,
            targetProductId,
            mergedSourceIds: result.mergedSourceIds,
        }, 'products_merge');
        return res.json({ ok: true, mergedSourceIds: result.mergedSourceIds });
    }
    catch (err) {
        const status = err.status;
        if (status === 400) {
            return res.status(400).json({ error: err.message });
        }
        logger.error({ err }, 'Failed to merge products');
        return res.status(500).json({ error: 'Failed to merge products' });
    }
}
export async function normalizeProducts(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'organization required' });
        const { rawNames, targetNormalizedName } = req.body;
        if (!Array.isArray(rawNames) || !rawNames.length || !targetNormalizedName) {
            return res.status(400).json({ error: 'rawNames[] and targetNormalizedName are required' });
        }
        const target = normalizeProductName(targetNormalizedName);
        if (!target)
            return res.status(400).json({ error: 'targetNormalizedName is invalid after normalization' });
        const updated = await productNameAliasesModel.bulkNormalize(orgId, rawNames, target);
        const product = await productsModel.findOrCreateProduct(targetNormalizedName, target, false, orgId);
        await productAuditLog.insertAudit({
            organizationId: orgId,
            productId: product.id,
            action: 'normalize',
            actorId: req.user?.userId ?? null,
            meta: { rawNames, targetNormalizedName, updated },
        });
        return res.json({ ok: true, updated });
    }
    catch (err) {
        logger.error({ err }, 'Failed to normalize products');
        return res.status(500).json({ error: 'Failed to normalize products' });
    }
}
export async function getDuplicates(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'organization required' });
        const threshold = Number(req.query.threshold) || DUPLICATE_SIMILARITY_SUGGEST;
        const pairs = await findDuplicatePairs(orgId, threshold);
        return res.json({ pairs });
    }
    catch (err) {
        logger.error({ err }, 'getDuplicates failed');
        return res.status(500).json({ error: 'Failed to list duplicates' });
    }
}
export async function postAutoMerge(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'organization required' });
        const userId = req.user?.userId ?? null;
        const merged = await runAutoMergeDuplicates(orgId, DUPLICATE_SIMILARITY_AUTO, userId);
        return res.json({ ok: true, merged });
    }
    catch (err) {
        logger.error({ err }, 'postAutoMerge failed');
        return res.status(500).json({ error: 'Failed to auto-merge duplicates' });
    }
}
export async function getProductHistory(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'organization required' });
        const { id } = req.params;
        const history = await productAuditLog.getByProductId(orgId, id, 200);
        return res.json({ history });
    }
    catch (err) {
        logger.error({ err }, 'getProductHistory failed');
        return res.status(500).json({ error: 'Failed to load product history' });
    }
}
