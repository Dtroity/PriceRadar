import { Fragment, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, type IngestionRecord } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import { useAuth } from '../auth/AuthContext';
import UnifiedIngestionUpload from '../components/UnifiedIngestionUpload';

function statusClass(status: string): string {
  if (status === 'completed') return 'text-emerald-700 bg-emerald-50';
  if (status === 'failed' || status === 'rejected_duplicate') return 'text-red-800 bg-red-50';
  if (status === 'pending_confirm' || status === 'pending_duplicate_confirm') return 'text-amber-900 bg-amber-50';
  return 'text-slate-700 bg-slate-100';
}

export default function IngestionManagement() {
  const t = useT();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [items, setItems] = useState<IngestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await api.ingestion.list(100);
      setItems(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (id: string) => {
    if (!window.confirm(t('ingestion.deleteConfirm'))) return;
    try {
      await api.ingestion.remove(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t('ingestion.historyTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('ingestion.historyLead')}</p>
        </div>
        <Link
          to={isEmployee ? '/employee' : '/'}
          className="text-sm font-medium text-amber-800 underline hover:text-amber-950"
        >
          ← {isEmployee ? t('ingestion.backToEmployee') : t('ingestion.backToHub')}
        </Link>
      </div>

      <UnifiedIngestionUpload onCompleted={() => void load()} />

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">{t('dashboard.loading')}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">{t('ingestion.empty')}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left">{t('ingestion.colWhen')}</th>
                  <th className="px-3 py-2 text-left">{t('ingestion.colFile')}</th>
                  <th className="px-3 py-2 text-left">{t('ingestion.colStatus')}</th>
                  <th className="px-3 py-2 text-left">{t('ingestion.colKind')}</th>
                  <th className="px-3 py-2 text-left">{t('ingestion.colSummary')}</th>
                  <th className="px-3 py-2 text-left" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{row.originalFilename}</span>
                        {row.duplicateOfId && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                            {t('ingestion.duplicateBadge')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                          {t(`ingestion.status.${row.status}` as 'ingestion.status.completed') || row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.confirmedKind || row.suggestedKind}
                      </td>
                      <td className="max-w-[280px] px-3 py-2 text-xs text-slate-600">
                        {row.errorMessage ? (
                          <span className="text-red-800">{row.errorMessage}</span>
                        ) : (
                          <div className="space-y-1">
                            {typeof row.summary?.rows === 'number' && (
                              <div>
                                {t('ingestion.rows')}: {row.summary.rows}
                                {typeof row.summary?.changes === 'number' && (
                                  <>
                                    {' '}
                                    · {t('ingestion.summaryChanges')}: {row.summary.changes}
                                  </>
                                )}
                              </div>
                            )}
                            {typeof row.summary?.line_items === 'number' && (
                              <div>
                                {t('ingestion.lines')}: {row.summary.line_items}
                              </div>
                            )}
                            {row.summary?.hadPreviousPriceList === false &&
                              Number(row.summary?.changes) === 0 &&
                              typeof row.summary?.rows === 'number' &&
                              row.summary.rows > 0 && (
                                <p className="text-[11px] leading-snug text-amber-950">
                                  {t('ingestion.summaryFirstPriceList')}
                                </p>
                              )}
                            {!row.summary?.rows &&
                              !row.summary?.line_items &&
                              !row.errorMessage &&
                              '—'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {row.documentId && !isEmployee && (
                          <Link
                            className="mr-2 text-amber-800 underline hover:text-amber-950"
                            to={`/documents/${row.documentId}`}
                          >
                            {t('ingestion.openDoc')}
                          </Link>
                        )}
                        <button
                          type="button"
                          className="text-red-700 underline hover:text-red-900"
                          onClick={() => void onDelete(row.id)}
                        >
                          {t('ingestion.delete')}
                        </button>
                        <button
                          type="button"
                          className="ml-2 text-slate-600 underline"
                          onClick={() => setExpanded((e) => (e === row.id ? null : row.id))}
                        >
                          {expanded === row.id ? t('ingestion.collapse') : t('ingestion.details')}
                        </button>
                      </td>
                    </tr>
                    {expanded === row.id && (
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <td colSpan={6} className="px-4 py-3 font-mono text-xs text-slate-700">
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all">
                            {JSON.stringify({ detection: row.detection, summary: row.summary }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
