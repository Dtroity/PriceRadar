import * as priceChangesModel from '../models/priceChanges.js';
export async function list(req, res) {
    try {
        const supplierId = req.query.supplierId;
        const fromDate = req.query.fromDate;
        const toDate = req.query.toDate;
        const minPercent = req.query.minPercent != null ? Number(req.query.minPercent) : undefined;
        const maxPercent = req.query.maxPercent != null ? Number(req.query.maxPercent) : undefined;
        const priorityOnly = req.query.priorityOnly === 'true';
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const changes = await priceChangesModel.getPriceChanges({ supplierId, fromDate, toDate, minPercent, maxPercent, priorityOnly }, limit);
        return res.json({ changes });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch price changes' });
    }
}
export async function priceHistory(req, res) {
    try {
        const productId = req.params.productId;
        const supplierId = req.query.supplierId;
        const history = await priceChangesModel.getPriceHistory(productId, supplierId);
        return res.json({ history });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch price history' });
    }
}
