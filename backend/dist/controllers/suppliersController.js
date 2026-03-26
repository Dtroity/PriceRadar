import * as suppliersModel from '../models/suppliers.js';
import * as suppliersMt from '../models/suppliers-mt.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { sendSupplierOrderEmail } from '../services/emailNotifier.js';
import * as filtersModel from '../models/supplierFilters.js';
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
export async function createSupplier(req, res) {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(400).json({ error: 'Organization required' });
        const name = String(req.body?.name ?? '').trim();
        if (!name)
            return res.status(400).json({ error: 'name required' });
        const created = await suppliersMt.findOrCreate(orgId, name);
        return res.status(201).json(created);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to create supplier' });
    }
}
export async function patchSupplier(req, res) {
    const orgId = req.user?.organizationId;
    if (!orgId)
        return res.status(400).json({ error: 'Organization required' });
    const id = req.params.id;
    const body = req.body;
    const allowedChannels = new Set(['email', 'telegram', 'both', 'none']);
    const notify_channel = body.notify_channel == null ? undefined : String(body.notify_channel);
    if (notify_channel !== undefined && !allowedChannels.has(notify_channel)) {
        return res.status(400).json({ error: 'Invalid notify_channel' });
    }
    const { rows } = await pool.query(`
    UPDATE suppliers SET
      contact_name = COALESCE($3, contact_name),
      email = COALESCE($4, email),
      phone = COALESCE($5, phone),
      notify_channel = COALESCE($6, notify_channel),
      is_active = COALESCE($7, is_active)
    WHERE id = $1::uuid AND organization_id = $2::uuid
    RETURNING id, organization_id, name, created_at, contact_name, email, phone, telegram_chat_id, notify_channel, is_active
    `, [
        id,
        orgId,
        body.contact_name ?? null,
        body.email ?? null,
        body.phone ?? null,
        notify_channel ?? null,
        body.is_active ?? null,
    ]);
    if (!rows[0])
        return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
}
export async function listSupplierFilters(req, res) {
    const orgId = req.user?.organizationId;
    if (!orgId)
        return res.status(400).json({ error: 'Organization required' });
    const supplierId = req.params.id;
    const filters = await filtersModel.listFiltersBySupplier({ organizationId: orgId, supplierId });
    return res.json({ filters });
}
export async function addSupplierFilter(req, res) {
    const orgId = req.user?.organizationId;
    if (!orgId)
        return res.status(400).json({ error: 'Organization required' });
    const supplierId = req.params.id;
    const keyword = String(req.body?.keyword ?? '').trim();
    if (!keyword)
        return res.status(400).json({ error: 'keyword required' });
    const created = await filtersModel.createFilter({ organizationId: orgId, supplierId, keyword });
    return res.status(201).json(created);
}
export async function deleteSupplierFilter(req, res) {
    const orgId = req.user?.organizationId;
    if (!orgId)
        return res.status(400).json({ error: 'Organization required' });
    const supplierId = req.params.id;
    const filterId = req.params.filterId;
    const ok = await filtersModel.deleteFilter({ organizationId: orgId, supplierId, filterId });
    if (!ok)
        return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
}
export async function inviteSupplier(req, res) {
    const orgId = req.user?.organizationId;
    if (!orgId)
        return res.status(400).json({ error: 'Organization required' });
    const supplierId = req.params.id;
    const { rows: orgRows } = await pool.query('SELECT name FROM organizations WHERE id = $1::uuid', [orgId]);
    const restaurantName = orgRows[0]?.name ?? 'Ресторан';
    const { rows } = await pool.query(`
    UPDATE suppliers
    SET invite_token = gen_random_uuid()::text
    WHERE id = $1::uuid AND organization_id = $2::uuid
    RETURNING id, name, email, contact_name, invite_token
    `, [supplierId, orgId]);
    const s = rows[0];
    if (!s)
        return res.status(404).json({ error: 'Not found' });
    if (!s.email)
        return res.status(400).json({ error: 'Supplier email is required' });
    const linkBase = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const inviteLink = `${linkBase}/register?supplierInvite=${encodeURIComponent(s.invite_token ?? '')}`;
    await sendSupplierOrderEmail({
        to: s.email,
        contactName: s.contact_name ?? s.name,
        restaurantName,
        items: [],
        orderLink: inviteLink,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        subject: `Vizor360: приглашение поставщику (${restaurantName})`,
    });
    return res.json({ ok: true });
}
