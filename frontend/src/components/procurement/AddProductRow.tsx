import { useMemo, useState } from 'react';
import type { Product } from '../../api/client';
import { addOrderItem, priceHint } from '../../api/procurementClient';
import { useT } from '../../i18n/LocaleContext';

export default function AddProductRow({
  orderId,
  products,
  onAdded,
}: {
  orderId: string;
  products: Product[];
  onAdded: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('кг');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(s) || p.normalized_name.toLowerCase().includes(s))
      .slice(0, 12);
  }, [products, q]);

  const pickProduct = async (p: Product) => {
    setQ(p.name);
    setOpen(false);
    setErr(null);
    const n = Number.parseFloat(qty.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      setErr(t('procurement.invalidQty'));
      return;
    }
    setLoading(true);
    try {
      const hint = await priceHint(p.id);
      await addOrderItem(orderId, {
        product_id: p.id,
        quantity: n,
        unit,
        target_price: hint.target_price ?? undefined,
        supplier_id: hint.supplier_id ?? undefined,
      });
      setQty('1');
      setQ('');
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative border-t border-slate-100 bg-slate-50/80 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">{t('procurement.addLine')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder={t('procurement.searchProduct')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && filtered.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => pickProduct(p)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-sm"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={t('procurement.quantity')}
        />
        <input
          className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <button
          type="button"
          disabled={loading || !q.trim()}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => {
            const s = q.trim().toLowerCase();
            const exact = products.find((p) => p.name.toLowerCase() === s);
            if (exact) void pickProduct(exact);
            else setErr(t('procurement.pickFromList'));
          }}
        >
          {loading ? '…' : t('procurement.add')}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
