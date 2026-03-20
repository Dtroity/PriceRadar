import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api, type Document, type DocumentItem, type Product } from '../api/client';
import { useT } from '../i18n/LocaleContext';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const [doc, setDoc] = useState<(Document & { items: DocumentItem[] }) | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.documents.get(id), api.products().then((r) => r.products)])
      .then(([d, prods]) => {
        setDoc(d);
        setProducts(prods);
      })
      .catch(() => setError(t('documentDetail.documentNotFound')))
      .finally(() => setLoading(false));
  }, [id]);

  const updateItem = (itemId: string, field: keyof DocumentItem, value: string | number | null) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{t('documentDetail.title')}</h1>
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="text-sm text-slate-600 underline hover:text-slate-800"
        >
          {t('documentDetail.backToList')}
        </button>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
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
        {doc.confidence != null && (
          <span>
            {t('documents.confidence')}: {Math.round(doc.confidence * 100)}%
          </span>
        )}
        {doc.ocr_confidence != null && (
          <span>
            {t('documentDetail.ocrConfidence')}: {Math.round(doc.ocr_confidence * 100)}%
          </span>
        )}
        {doc.ocr_engine && (
          <span>
            {t('documentDetail.ocrEngine')}: {doc.ocr_engine}
          </span>
        )}
        {doc.parse_source && (
          <span>
            {t('documentDetail.parseSource')}: {doc.parse_source}
          </span>
        )}
        {doc.total_amount != null && <span>Total: {doc.total_amount.toFixed(2)}</span>}
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-100 rounded-xl p-4 min-h-[400px] flex items-center justify-center">
          <p className="text-slate-500">{t('documentDetail.originalFile')}: {doc.file_path}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2 px-3">{t('documentDetail.name')}</th>
                <th className="text-right py-2 px-3 w-20">{t('documentDetail.qty')}</th>
                <th className="text-right py-2 px-3 w-24">{t('documentDetail.price')}</th>
                <th className="text-right py-2 px-3 w-24">{t('documentDetail.sum')}</th>
                <th className="text-left py-2 px-3">{t('documentDetail.product')}</th>
                <th className="w-16"></th>
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
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-1 px-3">
                      <input
                        type="text"
                        value={item.name ?? ''}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value || null)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1 px-3 text-right">
                      <input
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={item.price ?? ''}
                        onChange={(e) => updateItem(item.id, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={item.sum ?? ''}
                        onChange={(e) => updateItem(item.id, 'sum', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <select
                        value={item.product_id ?? ''}
                        onChange={(e) => updateItem(item.id, 'product_id', e.target.value || null)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      >
                        <option value="">—</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-3">
                      <button
                        type="button"
                        onClick={() => saveItem(item)}
                        disabled={saving === item.id}
                        className="text-xs text-slate-600 underline hover:text-slate-800 disabled:opacity-50"
                      >
                        {saving === item.id ? '…' : t('documentDetail.save')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={confirmDocument}
              disabled={doc.status === 'verified' || confirming}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-slate-700"
            >
              {confirming ? t('documentDetail.confirming') : t('documentDetail.confirmDocument')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
