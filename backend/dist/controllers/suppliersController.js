import * as suppliersModel from '../models/suppliers.js';
import * as suppliersMt from '../models/suppliers-mt.js';
import { config } from '../config.js';
export async function list(req, res) {
    try {
        const authReq = req;
        if (config.multiTenant && authReq.user?.organizationId) {
            const suppliers = await suppliersMt.getAllByOrganization(authReq.user.organizationId);
            return res.json({ suppliers });
        }
        const suppliers = await suppliersModel.getAllSuppliers();
        return res.json({ suppliers });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
}
