import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Document } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useAuth } from '../auth/AuthContext';
import { formatRelativeDate } from '../lib/formatRelativeDate';
import PullToRefreshContainer from '../components/layout/PullToRefreshContainer';
import SwipeableRow from '../components/layout/SwipeableRow';
import UnifiedIngestionUpload from '../components/UnifiedIngestionUpload';
import IngestionJournalSection from '../components/IngestionJournalSection';

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
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [journalKey, setJournalKey] = useState(0);
  const [sortKey, setSortKey] = useState<
    'document_number' | 'supplier_name' | 'document_date' | 'status' | 'ocr' | 'confidence' | 'total_amount'
  >('document_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const statusLabel = (s: string) => (s ? t('documents.' + s) : t('documents.allStatuses'));

  const sortedDocuments = [...documents].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'document_number') {
      return String(a.document_number ?? '').localeCompare(String(b.document_number ?? ''), 'ru') * mul;
    }
    if (sortKey === 'supplier_name') {
      return String(a.supplier_name ?? '').localeCompare(String(b.supplier_name ?? ''), 'ru') * mul;
    }
    if (sortKey === 'status') {
      return String(a.status ?? '').localeCompare(String(b.status ?? ''), 'ru') * mul;
    }
    if (sortKey === 'document_date') {
      const ta = a.document_date ? new Date(a.document_date).getTime() : 0;
      const tb = b.document_date ? new Date(b.document_date).getTime() : 0;
      return (ta - tb) * mul;
    }
    if (sortKey === 'ocr') {
      const aa = a.status === 'ocr_failed' ? -1 : a.ocr_confidence ?? -2;
      const bb = b.status === 'ocr_failed' ? -1 : b.ocr_confidence ?? -2;
      return (aa - bb) * mul;
    }
    if (sortKey === 'confidence') {
      return ((a.confidence ?? -1) - (b.confidence ?? -1)) * mul;
    }
    const aa = a.total_amount ?? -1;
    const bb = b.total_amount ?? -1;
    return (aa - bb) * mul;
  });

  const onSort = (k: typeof sortKey) => {
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir(k === 'document_date' ? 'desc' : 'asc');
      return;
    }
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const sortArrow = (k: typeof sortKey) => (sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '');
  const thBtn = 'inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900';

  const listBody = loading ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
      {t('documents.loading')}
    </div>
  ) : documents.length === 0 ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
      {t('documents.noDocuments')}
    </div>
  ) : bp === 'mobile' ? (
    <div className="flex flex-col gap-3">
      {sortedDocuments.map((d) => (
        <DocumentCard key={d.id} doc={d} t={t} onOpen={() => navigate(`/documents/${d.id}`)} />
      ))}
    </div>
  ) : (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto md:-mx-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left">
                <button type="button" className={thBtn} onClick={() => onSort('document_number')}>
                  {t('documents.number')} {sortArrow('document_number')}
                </button>
              </th>
              <th className="px-3 py-2 text-left">
                <button type="button" className={thBtn} onClick={() => onSort('supplier_name')}>
                  {t('documents.supplier')} {sortArrow('supplier_name')}
                </button>
              </th>
              <th className="px-3 py-2 text-left">
                <button type="button" className={thBtn} onClick={() => onSort('document_date')}>
                  {t('documents.date')} {sortArrow('document_date')}
                </button>
              </th>
              <th className="px-3 py-2 text-left">
                <button type="button" className={thBtn} onClick={() => onSort('status')}>
                  {t('documents.status')} {sortArrow('status')}
                </button>
              </th>
              <th className="px-3 py-2 text-left">
                <button type="button" className={thBtn} onClick={() => onSort('ocr')}>
                  {t('documents.ocrQuality')} {sortArrow('ocr')}
                </button>
              </th>
              <th className="px-3 py-2 text-left">
                <button type="button" className={thBtn} onClick={() => onSort('confidence')}>
                  {t('documents.confidence')} {sortArrow('confidence')}
                </button>
              </th>
              <th className="px-3 py-2 text-left">
                <button type="button" className={thBtn} onClick={() => onSort('total_amount')}>
                  {t('documents.total')} {sortArrow('total_amount')}
                </button>
              </th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {sortedDocuments.map((d) => (
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t('documents.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('documents.unifiedModuleLead')}</p>
        </div>
        {isEmployee ? (
          <Link
            to="/employee"
            className="text-sm font-medium text-amber-800 underline hover:text-amber-950"
          >
            ← {t('ingestion.backToEmployee')}
          </Link>
        ) : (
          <Link to="/" className="text-sm font-medium text-amber-800 underline hover:text-amber-950">
            ← {t('ingestion.backToHub')}
          </Link>
        )}
      </div>

      <UnifiedIngestionUpload
        onCompleted={() => {
          setJournalKey((k) => k + 1);
          void load();
        }}
      />

      <IngestionJournalSection isEmployee={isEmployee} refreshKey={journalKey} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{t('documents.profileDocumentsTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('documents.profileDocumentsLead')}</p>
          </div>
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
        </div>

        {bp === 'mobile' ? (
          <PullToRefreshContainer onRefresh={async () => load()} enabled>
            {listBody}
          </PullToRefreshContainer>
        ) : (
          listBody
        )}
      </section>
    </div>
  );
}
