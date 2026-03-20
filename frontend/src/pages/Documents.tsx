import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type Document } from '../api/client';
import { useT } from '../i18n/LocaleContext';

const STATUS_OPTIONS = ['', 'pending', 'parsed', 'needs_review', 'verified', 'failed', 'ocr_failed'];

function documentOcrBadges(d: Document, t: (k: string) => string) {
  const ocr = d.ocr_confidence;
  const badges: { key: string; className: string; label: string }[] = [];
  if (d.parse_source === 'rules') {
    badges.push({
      key: 'rules',
      className: 'bg-slate-200 text-slate-700',
      label: t('documents.badgeRulesParser'),
    });
  }
  const lowOcr = d.status === 'ocr_failed' || (ocr != null && ocr < 0.6);
  const midOcr = !lowOcr && ocr != null && ocr >= 0.6 && ocr < 0.85;
  const highOcr = !lowOcr && ocr != null && ocr >= 0.85;
  if (lowOcr) {
    badges.push({
      key: 'ocr-fail',
      className: 'bg-red-100 text-red-800',
      label: t('documents.badgeOcrFailed'),
    });
  } else if (midOcr) {
    badges.push({
      key: 'ocr-review',
      className: 'bg-amber-100 text-amber-900',
      label: t('documents.badgeOcrReview'),
    });
  } else if (highOcr) {
    badges.push({
      key: 'ocr-ok',
      className: 'bg-emerald-50 text-emerald-800',
      label: t('documents.badgeOcrOk'),
    });
  }
  return badges;
}

export default function Documents() {
  const t = useT();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const status = statusFilter || undefined;
    api.documents
      .list(status)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    api.documents
      .upload(file, 'web')
      .then(() => {
        setStatusFilter('');
        return api.documents.list();
      })
      .then(setDocuments)
      .catch((err) => setUploadError(err instanceof Error ? err.message : t('documents.uploadFailed')))
      .finally(() => setUploading(false));
    e.target.value = '';
  };

  const statusLabel = (s: string) => (s ? t('documents.' + s) : t('documents.allStatuses'));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">{t('documents.title')}</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <label className="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
            <input type="file" className="hidden" accept=".pdf,image/*" onChange={onFileSelect} disabled={uploading} />
            {uploading ? t('documents.uploading') : t('documents.uploadInvoice')}
          </label>
        </div>
      </div>
      {uploadError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
      )}
      <p className="text-slate-600">
        {t('documents.moduleDescription')}. {t('documents.description')}
      </p>
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">{t('documents.loading')}</div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {t('documents.noDocuments')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-2 px-3">{t('documents.number')}</th>
                <th className="text-left py-2 px-3">{t('documents.supplier')}</th>
                <th className="text-left py-2 px-3">{t('documents.date')}</th>
                <th className="text-left py-2 px-3">{t('documents.status')}</th>
                <th className="text-left py-2 px-3">{t('documents.ocrQuality')}</th>
                <th className="text-left py-2 px-3">{t('documents.confidence')}</th>
                <th className="text-left py-2 px-3">{t('documents.total')}</th>
                <th className="text-left py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3">{d.document_number || '—'}</td>
                  <td className="py-2 px-3">{d.supplier_name || '—'}</td>
                  <td className="py-2 px-3">{d.document_date || '—'}</td>
                  <td className="py-2 px-3">
                    <span
                      className={
                        d.status === 'verified'
                          ? 'text-green-600'
                          : d.status === 'needs_review' || d.status === 'failed' || d.status === 'ocr_failed'
                            ? d.status === 'ocr_failed'
                              ? 'text-red-700 font-medium'
                              : 'text-amber-600'
                            : 'text-slate-600'
                      }
                    >
                      {t('documents.' + d.status)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(() => {
                        const badges = documentOcrBadges(d, t);
                        return (
                          <>
                            {badges.map((b) => (
                              <span key={b.key} className={`inline-block rounded px-1.5 py-0.5 text-xs ${b.className}`}>
                                {b.label}
                              </span>
                            ))}
                            {d.ocr_confidence != null && (
                              <span className="text-xs text-slate-500">
                                {Math.round(d.ocr_confidence * 100)}%
                              </span>
                            )}
                            {badges.length === 0 && d.ocr_confidence == null ? '—' : null}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="py-2 px-3">{d.confidence != null ? `${Math.round(d.confidence * 100)}%` : '—'}</td>
                  <td className="py-2 px-3">{d.total_amount != null ? d.total_amount.toFixed(2) : '—'}</td>
                  <td className="py-2 px-3">
                    <Link to={`/documents/${d.id}`} className="text-slate-700 underline hover:text-slate-900">
                      {t('documents.open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
