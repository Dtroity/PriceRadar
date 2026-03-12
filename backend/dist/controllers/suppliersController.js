import * as suppliersModel from '../models/suppliers.js';
export async function list(_req, res) {
    try {
        const suppliers = await suppliersModel.getAllSuppliers();
        return res.json({ suppliers });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
}
