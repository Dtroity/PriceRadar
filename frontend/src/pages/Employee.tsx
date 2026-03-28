import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import { request } from '../api/client';
import { Logo } from '../components/layout/Logo';

type Product = { id: string; name: string; unit?: string | null };

export default function EmployeePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'employee') navigate('/');
  }, [navigate, user]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    request<{ products: Product[] }>('/products')
      .then((r) => {
        if (!cancelled) setProducts(r.products ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalItems = useMemo(() => Object.values(qty).filter((v) => v > 0).length, [qty]);

  const handleSubmit = async () => {
    const items = Object.entries(qty)
      .filter(([, v]) => v > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      await request('/procurement/orders', {
        method: 'POST',
        body: JSON.stringify({ title: 'Заказ сотрудника', items }),
      });
      setQty({});
      navigate('/employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center gap-2">
        <Logo size="sm" />
        <div className="flex flex-col items-end gap-1 text-right">
          <Link
            to="/documents"
            className="text-sm font-medium text-amber-800 underline hover:text-amber-950"
          >
            {t('employee.ingestionLink')}
          </Link>
          <span className="text-sm text-slate-500">{new Date().toLocaleDateString('ru-RU')}</span>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-slate-500">Загрузка…</div>
      ) : (
        <div className="divide-y bg-white">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{product.name}</p>
                {product.unit && <p className="text-sm text-slate-500">{product.unit}</p>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="w-9 h-9 rounded-full border text-lg flex items-center justify-center"
                  onClick={() =>
                    setQty((q) => ({ ...q, [product.id]: Math.max(0, (q[product.id] || 0) - 1) }))
                  }
                >
                  −
                </button>
                <span className="w-10 text-center font-mono text-lg">{qty[product.id] || 0}</span>
                <button
                  type="button"
                  className="w-9 h-9 rounded-full bg-indigo-600 text-white text-lg flex items-center justify-center"
                  onClick={() => setQty((q) => ({ ...q, [product.id]: (q[product.id] || 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 p-4 bg-white border-t">
        <button
          type="button"
          className="w-full h-12 rounded-lg bg-slate-900 text-white text-base font-medium disabled:opacity-50"
          disabled={totalItems === 0 || submitting}
          onClick={() => void handleSubmit()}
        >
          Отправить заказ{totalItems > 0 ? ` (${totalItems} позиций)` : ''}
        </button>
      </div>
    </div>
  );
}

