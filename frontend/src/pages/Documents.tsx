import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Document } from '../api/client';
import { pollPriceUploadJob } from '../lib/pollPriceUploadJob';
import { useT } from '../i18n/LocaleContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { formatRelativeDate } from '../lib/formatRelativeDate';
import PullToRefreshContainer from '../components/layout/PullToRefreshContainer';
import SwipeableRow from '../components/layout/SwipeableRow';

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

function fileLabel(doc: Document): string {
  if (doc.document_number) return doc.document_number;
  const p = doc.file_path || '';
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p || '—';
}

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  return (
    <span
      className={
        status === 'verified'
          ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-green-700'
          : status === 'needs_review' || status === 'failed' || status === 'ocr_failed'
            ? status === 'ocr_failed'
              ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800'
              : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800'
            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'
      }
    >
      {t('documents.' + status)}
    </span>
  );
}

function DocumentCard({
  doc,
  t,
  onOpen,
}: {
  doc: Document;
  t: (k: string) => string;
  onOpen: () => void;
}) {
  const badges = documentOcrBadges(doc, t);
  return (
    <SwipeableRow onSwipeLeft={onOpen}>
      <Link
        to={`/documents/${doc.id}`}
        className="block rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm active:bg-[var(--surface-raised)]"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{fileLabel(doc)}</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{doc.supplier_name || '—'}</p>
          </div>
          <StatusBadge status={doc.status} t={t} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
          {badges.map((b) => (
            <span key={b.key} className={`rounded px-1.5 py-0.5 ${b.className}`}>
              {b.label}
            </span>
          ))}
          {doc.ocr_confidence != null && (
            <span>OCR {Math.round(doc.ocr_confidence * 100)}%</span>
          )}
          <span>{formatRelativeDate(doc.created_at)}</span>
        </div>
        {doc.total_amount != null && (
          <p className="mt-2 text-sm font-medium text-slate-800">{doc.total_amount.toFixed(2)}</p>
        )}
      </Link>
    </SwipeableRow>
  );
}

export default function Documents() {
  const t = useT();
  const bp = useBreakpoint();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<'document' | 'price'>('document');
  const [priceSupplier, setPriceSupplier] = useState('');

  const load = async () => {
    const status = statusFilter || undefined;
    const list = await api.documents.list(status);
    setDocuments(list);
  };

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadInfo(null);
    setUploading(true);

    const run = async () => {
      try {
        if (uploadKind === 'price') {
          setUploadInfo(t('upload.toastPriceStarted'));
          const res = await api.upload(file, priceSupplier.trim() || 'Unknown Supplier', 'web');
          const jobId = res.jobId != null ? String(res.jobId) : '';
          if (jobId) {
            setUploadInfo(t('upload.progressProcessing'));
            const outcome = await pollPriceUploadJob(jobId, (phase) => {
              if (phase === 'active') setUploadInfo(t('upload.progressActive'));
              else if (phase === 'queued') setUploadInfo(t('upload.progressQueued'));
            });
            if (outcome === 'completed') {
              setUploadInfo(t('upload.toastPriceDone'));
            } else if (outcome === 'failed') {
              try {
                const st = await api.uploadJobStatus(jobId);
                setUploadError(st.failedReason || t('upload.toastPriceFailed'));
                setUploadInfo(null);
              } catch {
                setUploadError(t('upload.toastPriceFailed'));
                setUploadInfo(null);
              }
            } else {
              setUploadInfo(t('upload.toastPriceStillRunning'));
            }
          } else {
            setUploadInfo(t('upload.queued'));
          }
          return;
        }

        await api.documents.upload(file, 'web');
        setUploadInfo(t('upload.toastDocumentQueued'));
        setStatusFilter('');
        const list = await api.documents.list();
        setDocuments(list);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : t('documents.uploadFailed'));
        setUploadInfo(null);
      } finally {
        setUploading(false);
      }
    };

    void run();
    e.target.value = '';
  };

  const statusLabel = (s: string) => (s ? t('documents.' + s) : t('documents.allStatuses'));

  const listBody = loading ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">{t('documents.loading')}</div>
  ) : documents.length === 0 ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
      {t('documents.noDocuments')}
    </div>
  ) : bp === 'mobile' ? (
    <div className="flex flex-col gap-3">
      {documents.map((d) => (
        <DocumentCard key={d.id} doc={d} t={t} onOpen={() => navigate(`/documents/${d.id}`)} />
      ))}
    </div>
  ) : (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto md:-mx-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left">{t('documents.number')}</th>
              <th className="px-3 py-2 text-left">{t('documents.supplier')}</th>
              <th className="px-3 py-2 text-left">{t('documents.date')}</th>
              <th className="px-3 py-2 text-left">{t('documents.status')}</th>
              <th className="px-3 py-2 text-left">{t('documents.ocrQuality')}</th>
              <th className="px-3 py-2 text-left">{t('documents.confidence')}</th>
              <th className="px-3 py-2 text-left">{t('documents.total')}</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="h-12 border-b border-slate-100 md:h-14 hover:bg-slate-50">
                <td className="px-3 py-2">{d.document_number || '—'}</td>
                <td className="px-3 py-2">{d.supplier_name || '—'}</td>
                <td className="px-3 py-2">{d.document_date || '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      d.status === 'verified'
                        ? 'text-green-600'
                        : d.status === 'needs_review' || d.status === 'failed' || d.status === 'ocr_failed'
                          ? d.status === 'ocr_failed'
                            ? 'font-medium text-red-700'
                            : 'text-amber-600'
                          : 'text-slate-600'
                    }
                  >
                    {t('documents.' + d.status)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {documentOcrBadges(d, t).map((b) => (
                      <span key={b.key} className={`inline-block rounded px-1.5 py-0.5 text-xs ${b.className}`}>
                        {b.label}
                      </span>
                    ))}
                    {d.ocr_confidence != null && (
                      <span className="text-xs text-slate-500">{Math.round(d.ocr_confidence * 100)}%</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">{d.confidence != null ? `${Math.round(d.confidence * 100)}%` : '—'}</td>
                <td className="px-3 py-2">{d.total_amount != null ? d.total_amount.toFixed(2) : '—'}</td>
                <td className="px-3 py-2">
                  <Link
                    to={`/documents/${d.id}`}
                    className="table-action-icon text-slate-700 underline hover:text-slate-900 tap-target-row rounded"
                  >
                    {t('documents.open')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">{t('documents.title')}</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div
            className="flex max-w-md rounded-lg bg-slate-100 p-1"
            role="group"
            aria-label={t('documents.uploadKindLabel')}
          >
            <button
              type="button"
              onClick={() => setUploadKind('document')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium min-h-[44px] ${
                uploadKind === 'document' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t('documents.uploadAsDocument')}
            </button>
            <button
              type="button"
              onClick={() => setUploadKind('price')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium min-h-[44px] ${
                uploadKind === 'price' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t('documents.uploadAsPrice')}
            </button>
          </div>
          {uploadKind === 'price' && (
            <input
              type="text"
              value={priceSupplier}
              onChange={(e) => setPriceSupplier(e.target.value)}
              placeholder={t('upload.supplierPlaceholder')}
              disabled={uploading}
              className="min-h-[44px] w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
            />
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
            <input
              type="file"
              className="hidden"
              accept=".xls,.xlsx,.csv,.pdf,.doc,.docx,image/*"
              onChange={onFileSelect}
              disabled={uploading}
            />
            {uploading ? t('documents.uploading') : t('documents.uploadInvoice')}
          </label>
        </div>
      </div>
      {uploadError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
      )}
      {uploadInfo && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{uploadInfo}</div>}
      <p className="text-slate-600">
        {t('documents.moduleDescription')}. {t('documents.description')}
      </p>

      {bp === 'mobile' ? (
        <PullToRefreshContainer onRefresh={async () => load()} enabled>
          {listBody}
        </PullToRefreshContainer>
      ) : (
        listBody
      )}
    </div>
  );
}
