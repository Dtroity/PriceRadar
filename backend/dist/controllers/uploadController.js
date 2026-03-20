import { uploadQueue } from '../workers/queue.js';
export async function upload(req, res) {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const supplierName = req.body.supplierName?.trim() || 'Unknown Supplier';
        const sourceType = req.body.sourceType || 'web';
        if (!['web', 'telegram', 'camera'].includes(sourceType)) {
            return res.status(400).json({ error: 'Invalid sourceType' });
        }
        const authReq = req;
        const organizationId = authReq.user?.organizationId;
        const job = await uploadQueue.add('process', {
            filePath: file.path,
            supplierName,
            sourceType: sourceType,
            mimeType: file.mimetype,
            originalName: file.originalname,
            ...(organizationId && { organizationId }),
        }, { attempts: 2, backoff: { type: 'exponential', delay: 2000 } });
        return res.status(202).json({
            message: 'Upload queued',
            jobId: job.id,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Upload failed' });
    }
}
