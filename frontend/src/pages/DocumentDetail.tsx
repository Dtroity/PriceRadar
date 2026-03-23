import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api, type Document, type DocumentItem, type Product } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { cn } from '../lib/cn';
import { IconChevronDown, IconImage } from '../components/layout/NavIcons';

function ItemEditSheet({
  open,
  item,
  products,
  saving,
  onClose,
  onSave,
  updateLocal,
}: {
  open: boolean;
  item: DocumentItem | null;
  products: Product[];
  saving: boolean;
  onClose: () => void;
  onSave: (item: DocumentItem) => void;
  updateLocal: (itemId: string, field: keyof DocumentItem, value: string | number | boolean | null) => void;
}) {
  const t = useT();
  if (!open || !item) return null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-[80] bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[90] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-white p-4 shadow-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <h3 className="mb-4 font-semibold text-slate-900">{item.name || '—'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-600">
            {t('documentDetail.qty')}
            <input
              type="number"
              step="any"
              className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-2"
              value={item.quantity}
              onChange={(e) => updateLocal(item.id, 'quantity', parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Ед.
            <input
              type="text"
              className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-2"
              value={item.unit ?? ''}
              onChange={(e) => updateLocal(item.id, 'unit', e.target.value || null)}
            />
          </label>
          <label className="text-xs text-slate-600">
            {t('documentDetail.price')}
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-2"
              value={item.price ?? ''}
              onChange={(e) =>
                updateLocal(item.id, 'price', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </label>
          <label className="text-xs text-slate-600">
            {t('documentDetail.sum')}
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-2"
              value={item.sum ?? ''}
              onChange={(e) =>
                updateLocal(item.id, 'sum', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-slate-600">
          {t('documentDetail.name')}
          <input
            type="text"
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-2"
            value={item.name ?? ''}
            onChange={(e) => updateLocal(item.id, 'name', e.target.value || null)}
          />
        </label>
        <label className="mt-3 block text-xs text-slate-600">
          {t('documentDetail.product')}
          <select
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-2"
            value={item.product_id ?? ''}
            onChange={(e) => updateLocal(item.id, 'product_id', e.target.value || null)}
          >
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={item.needs_review}
            onChange={(e) => updateLocal(item.id, 'needs_review', e.target.checked)}
            className="h-5 w-5 rounded"
          />
          needs_review
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(item)}
          className="mt-4 w-full min-h-[48px] rounded-xl bg-slate-800 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? '…' : t('sheet.save')}
        </button>
      </div>
    </>
  );
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const bp = useBreakpoint();
  const [doc, setDoc] = useState<(Document & { items: DocumentItem[] }) | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    setPreviewOpen(bp === 'desktop');
  }, [bp]);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.documents.get(id), api.products().then((r) => r.products)])
      .then(([d, prods]) => {
        setDoc(d);
        setProducts(prods);
      })
      .catch(() => setError(t('documentDetail.documentNotFound')))
      .finally(() => setLoading(false));
  }, [id, t]);

  const updateItem = (itemId: string, field: keyof DocumentItem, value: string | number | boolean | null) => {
    if (!doc) return;
    setDoc({
      ...doc,
      items: doc.items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)),
    });
  };

  const saveItem = async (item: DocumentItem) => {
    if (!id) return;
    setSaving(item.id);
    setError(null);
    try {
      await api.documents.patchItem(id, item.id, {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price ?? undefined,
        sum: item.sum ?? undefined,
        vat: item.vat ?? undefined,
        product_id: item.product_id,
        needs_review: item.needs_review,
      });
      setEditingItemId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('documentDetail.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  const confirmDocument = async () => {
    if (!id) return;
    setConfirming(true);
    setError(null);
    try {
      await api.documents.confirm(id);
      const updated = await api.documents.get(id);
      setDoc(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('documentDetail.confirmFailed'));
    } finally {
      setConfirming(false);
    }
  };

  const editingItem = doc?.items.find((i) => i.id === editingItemId) ?? null;

  if (loading || !doc) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">{t('documentDetail.title')}</h1>
        {error ? (
          <div className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>
        ) : (
          <div className="text-slate-500">{t('documentDetail.loading')}</div>
        )}
      </div>
    );
  }

  const editorTable = (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={cn('overflow-x-auto', bp !== 'desktop' && '-mx-4 px-4 md:mx-0 md:px-0')}>
        <table className={cn('w-full text-sm', bp !== 'mobile' && 'min-w-[700px]')}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left">{t('documentDetail.name')}</th>
              <th className="w-20 px-3 py-2 text-right">{t('documentDetail.qty')}</th>
              <th className="w-24 px-3 py-2 text-right">{t('documentDetail.price')}</th>
              <th className="w-24 px-3 py-2 text-right">{t('documentDetail.sum')}</th>
              <th className="px-3 py-2 text-left">{t('documentDetail.product')}</th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {doc.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  {t('documentDetail.noItems')}
                </td>
              </tr>
            ) : (
              doc.items.map((item) => (
                <tr key={item.id} className="h-12 border-b border-slate-100 md:h-14">
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={item.name ?? ''}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value || null)}
                      className="min-h-[44px] w-full rounded border border-slate-200 px-2 py-2 text-sm"
                    />
                  </td>
                  <td className="px-3 py-1 text-right">
                    <input
                      type="number"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="min-h-[44px] w-full rounded border border-slate-200 px-2 py-2 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-1 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={item.price ?? ''}
                      onChange={(e) =>
                        updateItem(item.id, 'price', e.target.value ? parseFloat(e.target.value) : null)
                      }
                      className="min-h-[44px] w-full rounded border border-slate-200 px-2 py-2 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-1 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={item.sum ?? ''}
                      onChange={(e) =>
                        updateItem(item.id, 'sum', e.target.value ? parseFloat(e.target.value) : null)
                      }
                      className="min-h-[44px] w-full rounded border border-slate-200 px-2 py-2 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-1">
                    <select
                      value={item.product_id ?? ''}
                      onChange={(e) => updateItem(item.id, 'product_id', e.target.value || null)}
                      className="min-h-[44px] w-full rounded border border-slate-200 px-2 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1">
                    <button
                      type="button"
                      onClick={() => saveItem(item)}
                      disabled={saving === item.id}
                      className="table-action-icon text-xs text-slate-600 underline hover:text-slate-800 md:min-h-[44px]"
                    >
                      {saving === item.id ? '…' : t('documentDetail.save')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const mobileCards = (
    <div className="flex flex-col gap-3">
      {doc.items.length === 0 ? (
        <p className="text-slate-500">{t('documentDetail.noItems')}</p>
      ) : (
        doc.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setEditingItemId(item.id)}
            className="rounded-xl border border-[var(--border)] bg-white p-4 text-left shadow-sm active:bg-[var(--surface-raised)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-medium text-slate-900">{item.name || '—'}</p>
              {item.needs_review && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                  review
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {item.quantity} × {item.price != null ? item.price.toFixed(2) : '—'} ={' '}
              {item.sum != null ? item.sum.toFixed(2) : '—'}
            </p>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-4 md:pb-0">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-800">{t('documentDetail.title')}</h1>
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="tap-target-row shrink-0 rounded-lg text-sm text-slate-600 underline"
        >
          {t('documentDetail.backToList')}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>Supplier: {doc.supplier_name || '—'}</span>
        <span>Number: {doc.document_number || '—'}</span>
        <span>Date: {doc.document_date || '—'}</span>
        <span>
          {t('documents.status')}:{' '}
          <strong
            className={
              doc.status === 'verified'
                ? 'text-green-600'
                : doc.status === 'ocr_failed'
                  ? 'text-red-700'
                  : 'text-slate-800'
            }
          >
            {t('documents.' + doc.status)}
          </strong>
        </span>
        {doc.total_amount != null && <span>Total: {doc.total_amount.toFixed(2)}</span>}
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div
        className={cn(
          bp === 'desktop' ? 'grid grid-cols-[minmax(280px,420px)_1fr] gap-6' : 'flex flex-col gap-4'
        )}
      >
        {bp !== 'desktop' && (
          <button
            type="button"
            onClick={() => setPreviewOpen(!previewOpen)}
            className="flex min-h-[44px] items-center gap-2 text-sm text-[var(--text-secondary)]"
          >
            <IconImage className="w-4 h-4" />
            {previewOpen ? t('nav.preview.hide') : t('nav.preview.show')}
            <IconChevronDown className={cn('h-4 w-4 transition-transform', previewOpen && 'rotate-180')} />
          </button>
        )}

        {(bp === 'desktop' || previewOpen) && (
          <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-slate-100 p-4 md:min-h-[320px]">
            <p className="text-center text-slate-500">
              {t('documentDetail.originalFile')}: {doc.file_path}
            </p>
          </div>
        )}

        <div className="min-w-0">
          {bp === 'mobile' ? mobileCards : editorTable}
          <div
            className={cn(
              'mt-3 flex justify-end border-t border-slate-100 pt-3',
              bp === 'mobile' &&
                'sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 bg-slate-50/95 px-4 py-3 backdrop-blur-sm md:static md:bg-transparent md:px-0'
            )}
          >
            <button
              type="button"
              onClick={() => void confirmDocument()}
              disabled={doc.status === 'verified' || confirming}
              className="min-h-[48px] w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white disabled:opacity-50 hover:bg-slate-700 md:w-auto md:rounded-lg md:py-2"
            >
              {confirming ? t('documentDetail.confirming') : t('documentDetail.confirmDocument')}
            </button>
          </div>
        </div>
      </div>

      <ItemEditSheet
        open={editingItemId != null}
        item={editingItem}
        products={products}
        saving={saving === editingItemId}
        onClose={() => setEditingItemId(null)}
        onSave={(it) => void saveItem(it)}
        updateLocal={updateItem}
      />
    </div>
  );
}
