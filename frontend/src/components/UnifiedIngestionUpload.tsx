import { useState, useRef, useCallback, useId } from 'react';
import { Link } from 'react-router-dom';
import { api, type IngestionInitResponse, type IngestionRecord } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import { pollIngestionUntilDone } from '../lib/pollIngestionUntilDone';
import { pollPriceUploadJob } from '../lib/pollPriceUploadJob';
import { cn } from '../lib/cn';

type Toast = { id: number; tone: 'info' | 'ok' | 'err'; title: string; detail?: string };

type ConfirmState = {
  ingestionId: string;
  suggestedKind: string;
  alternateKind: string;
  detection: Record<string, unknown>;
};

type DuplicateState = {
  ingestionId: string;
  duplicateOf: { id: string; createdAt: string };
};

interface Props {
  onCompleted?: () => void;
}

export default function UnifiedIngestionUpload({ onCompleted }: Props) {
  const t = useT();
  const baseId = useId();
  const [drag, setDrag] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateState | null>(null);
  const [dupSupplier, setDupSupplier] = useState('');
  const [confirmKind, setConfirmKind] = useState<'price_list' | 'invoice_document'>('price_list');
  const [confirmSupplier, setConfirmSupplier] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pushToast = useCallback((tone: Toast['tone'], title: string, detail?: string) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev.slice(-4), { id, tone, title, detail }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), tone === 'err' ? 14000 : 9000);
  }, []);

  const followUpPoll = useCallback(
    async (ing: IngestionRecord) => {
      const id = ing.id;
      const isPrice = ing.confirmedKind === 'price_list';
      const jobId = ing.bullmqJobId;

      if (isPrice && jobId) {
        setProgressLabel(t('upload.progressProcessing'));
        const pu = await pollPriceUploadJob(jobId, (phase) => {
          if (phase === 'active') setProgressLabel(t('upload.progressActive'));
          else if (phase === 'queued') setProgressLabel(t('upload.progressQueued'));
        });
        setProgressLabel(null);
        if (pu === 'failed') {
          try {
            const st = await api.uploadJobStatus(jobId);
            pushToast('err', t('ingestion.priceJobFailed'), st.failedReason);
          } catch {
            pushToast('err', t('ingestion.priceJobFailed'));
          }
          onCompleted?.();
          return;
        }
      }

      const { outcome, last } = await pollIngestionUntilDone(id, () => {}, { intervalMs: 1600, maxAttempts: 90 });
      setProgressLabel(null);
      if (outcome === 'completed') {
        if (last.summary?.ocr_failed) {
          pushToast('info', t('ingestion.docOcrWeak'));
        } else if (last.confirmedKind === 'price_list' && typeof last.summary?.rows === 'number') {
          pushToast('ok', t('ingestion.donePriceSuccess').replace('{n}', String(last.summary.rows)));
        } else {
          pushToast('ok', t('ingestion.doneSuccess'));
        }
      } else if (outcome === 'failed') {
        pushToast('err', t('ingestion.doneFailed'), last.errorMessage ?? undefined);
      } else if (outcome === 'timeout') {
        pushToast('info', t('ingestion.doneTimeout'));
      }
      onCompleted?.();
    },
    [onCompleted, pushToast, t]
  );

  const handleInitResponse = useCallback(
    async (res: IngestionInitResponse) => {
      if (res.needsDuplicateDecision && res.duplicateOf && res.ingestion?.id) {
        setDupSupplier(supplierName);
        setDuplicate({ ingestionId: res.ingestion.id, duplicateOf: res.duplicateOf });
        return;
      }
      if (res.needsConfirmation && res.ingestion?.id) {
        const sk = (res.suggestedKind as string) || 'price_list';
        const ak = (res.alternateKind as string) || 'invoice_document';
        setConfirmKind(sk === 'price_list' ? 'price_list' : 'invoice_document');
        setConfirmSupplier(supplierName);
        setConfirm({
          ingestionId: res.ingestion.id,
          suggestedKind: sk,
          alternateKind: ak,
          detection: (res.detection as Record<string, unknown>) || {},
        });
        return;
      }
      pushToast('info', t('ingestion.routed'));
      await followUpPoll(res.ingestion);
    },
    [followUpPoll, pushToast, supplierName, t]
  );

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setProgressLabel(null);
    setConfirm(null);
    setDuplicate(null);
    try {
      const res = await api.ingestion.init(file, { supplierName: supplierName.trim() || undefined });
      await handleInitResponse(res);
    } catch (err) {
      pushToast('err', t('upload.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const submitConfirm = async () => {
    if (!confirm) return;
    setUploading(true);
    try {
      const res = await api.ingestion.confirm(confirm.ingestionId, {
        kind: confirmKind,
        supplierName: confirmKind === 'price_list' ? confirmSupplier.trim() || undefined : undefined,
      });
      setConfirm(null);
      pushToast('info', t('ingestion.routed'));
      await followUpPoll(res.ingestion);
    } catch (err) {
      pushToast('err', t('upload.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const submitDuplicateProceed = async () => {
    if (!duplicate) return;
    setUploading(true);
    try {
      const res = await api.ingestion.duplicateDecision(duplicate.ingestionId, {
        proceed: true,
        supplierName: dupSupplier.trim() || undefined,
      });
      setDuplicate(null);
      if (res.ingestion) {
        pushToast('info', t('ingestion.routed'));
        await followUpPoll(res.ingestion);
      }
    } catch (err) {
      pushToast('err', t('upload.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const submitDuplicateCancel = async () => {
    if (!duplicate) return;
    setUploading(true);
    try {
      await api.ingestion.duplicateDecision(duplicate.ingestionId, { proceed: false });
      setDuplicate(null);
      pushToast('info', t('ingestion.duplicateCancelled'));
    } catch (err) {
      pushToast('err', t('upload.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const reasons = confirm?.detection?.reasons;
  const reasonList = Array.isArray(reasons) ? (reasons as string[]) : [];

  return (
    <div className="relative space-y-4">
      <p className="text-center text-sm text-slate-600">{t('ingestion.hubLead')}</p>
      <div
        className={cn(
          'rounded-xl border-2 border-dashed p-6 transition-colors',
          drag ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void handleFile(f);
        }}
      >
        <input
          ref={inputRef}
          id={`${baseId}-file`}
          type="file"
          accept=".xls,.xlsx,.csv,.pdf,.doc,.docx,image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        <input
          type="text"
          placeholder={t('upload.supplierPlaceholder')}
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          className="mb-3 block w-full max-w-md mx-auto rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={uploading}
        />
        <p className="mb-2 text-center text-xs text-slate-500">{t('ingestion.supplierHint')}</p>
        <div className="text-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="min-h-[44px] rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {uploading ? t('upload.uploading') : t('ingestion.chooseAny')}
          </button>
          <p className="mt-2 text-xs text-slate-500">{t('upload.formats')}</p>
          <p className="mt-2 text-center text-sm">
            <Link className="font-medium text-amber-800 underline hover:text-amber-950" to="/documents#ingestion-journal">
              {t('ingestion.openHistory')} →
            </Link>
          </p>
        </div>
        {progressLabel && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-sm text-slate-600">{progressLabel}</p>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/3 animate-[uploadbar_1.2s_ease-in-out_infinite] rounded-full bg-amber-600" />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes uploadbar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>

      {duplicate && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${baseId}-dup-title`}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 id={`${baseId}-dup-title`} className="text-lg font-semibold text-slate-900">
              {t('ingestion.duplicateWarnTitle')}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{t('ingestion.duplicateWarnLead')}</p>
            <p className="mt-2 font-mono text-xs text-slate-500">
              {new Date(duplicate.duplicateOf.createdAt).toLocaleString()}
            </p>
            <input
              type="text"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={t('upload.supplierPlaceholder')}
              value={dupSupplier}
              onChange={(e) => setDupSupplier(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">{t('ingestion.supplierHint')}</p>
            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 min-h-[44px]"
                onClick={() => void submitDuplicateCancel()}
                disabled={uploading}
              >
                {t('ingestion.cancel')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50 min-h-[44px]"
                onClick={() => void submitDuplicateProceed()}
                disabled={uploading}
              >
                {t('ingestion.duplicateReplace')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${baseId}-ing-title`}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 id={`${baseId}-ing-title`} className="text-lg font-semibold text-slate-900">
              {t('ingestion.confirmTitle')}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{t('ingestion.confirmLead')}</p>
            {reasonList.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
                {reasonList.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmKind('price_list')}
                className={cn(
                  'flex-1 rounded-xl border-2 px-3 py-3 text-sm font-medium min-h-[48px]',
                  confirmKind === 'price_list'
                    ? 'border-amber-600 bg-amber-50 text-amber-950'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {t('upload.modePrice')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmKind('invoice_document')}
                className={cn(
                  'flex-1 rounded-xl border-2 px-3 py-3 text-sm font-medium min-h-[48px]',
                  confirmKind === 'invoice_document'
                    ? 'border-amber-600 bg-amber-50 text-amber-950'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {t('upload.modeDocument')}
              </button>
            </div>
            {confirmKind === 'price_list' && (
              <input
                type="text"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t('upload.supplierPlaceholder')}
                value={confirmSupplier}
                onChange={(e) => setConfirmSupplier(e.target.value)}
              />
            )}
            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 min-h-[44px]"
                onClick={() => setConfirm(null)}
                disabled={uploading}
              >
                {t('ingestion.cancel')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
                onClick={() => void submitConfirm()}
                disabled={uploading}
              >
                {t('ingestion.confirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((x) => (
          <div
            key={x.id}
            className={cn(
              'pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg',
              x.tone === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-950',
              x.tone === 'info' && 'border-slate-200 bg-white text-slate-800',
              x.tone === 'err' && 'border-red-200 bg-red-50 text-red-950'
            )}
          >
            <p className="font-medium">{x.title}</p>
            {x.detail && <p className="mt-1 text-xs opacity-90">{x.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
