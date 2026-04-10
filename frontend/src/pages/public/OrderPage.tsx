import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatSection } from '../../components/ChatSection';
import { Logo } from '../../components/layout/Logo';
import { useLocale } from '../../i18n/LocaleContext';

type PublicOrderResponse = {
  restaurantName: string;
  dispatch: {
    id: string;
    status: string;
    sentAt: string;
    respondedAt: string | null;
    expiresAt: string;
    supplierNote: string | null;
  };
  items: Array<{ id: string; product_id: string; product_name: string; quantity: string; unit: string | null }>;
};

export default function OrderPage() {
  const { t, locale } = useLocale();
  const { token } = useParams();
  const [data, setData] = useState<PublicOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const apiBase = useMemo(() => `/api/public/order/${encodeURIComponent(token || '')}`, [token]);

  const fetchOrder = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiBase);
      if (res.status === 410) {
        setExpired(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as PublicOrderResponse;
      setData(json);
      setExpired(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('publicOrder.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const accept = async () => {
    const res = await fetch(`${apiBase}/accept`, { method: 'POST' });
    if (res.ok) await fetchOrder();
  };

  const reject = async () => {
    const res = await fetch(`${apiBase}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: rejectNote || undefined }),
    });
    if (res.ok) {
      setRejectOpen(false);
      setRejectNote('');
      await fetchOrder();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-lg mx-auto rounded-xl border bg-white p-6">
          <div className="text-slate-500">{t('publicOrder.loading')}</div>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-lg mx-auto rounded-xl border bg-white p-6">
          <Logo size="sm" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">{t('publicOrder.linkInvalid')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('publicOrder.linkInvalidLead')}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-lg mx-auto rounded-xl border bg-white p-6">
          <Logo size="sm" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">{t('publicOrder.notFound')}</h1>
          {error && <pre className="mt-3 whitespace-pre-wrap text-xs text-red-700">{error}</pre>}
        </div>
      </div>
    );
  }

  const dispatchStatusLabel = (s: string) => {
    const k = `dispatch.status.${s}`;
    const lbl = t(k);
    return lbl === k ? s : lbl;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto p-4 pb-24">
        <div className="mb-6">
          <Logo size="sm" />
          <h1 className="mt-3 text-xl font-semibold">{data.restaurantName}</h1>
          <p className="text-sm text-slate-500">
            {t('publicOrder.orderFrom')}{' '}
            {new Date(data.dispatch.sentAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
          </p>
        </div>

        <div className="rounded-xl border bg-white">
          <div className="divide-y">
            {data.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 px-4 py-3">
                <span className="font-medium text-slate-900">{item.product_name}</span>
                <span className="font-mono text-slate-700">
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {data.dispatch.status === 'sent' ? (
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => void accept()}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-white font-medium"
            >
              {t('publicOrder.accept')}
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              className="flex-1 rounded-lg bg-rose-600 px-4 py-3 text-white font-medium"
            >
              {t('publicOrder.reject')}
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border bg-white px-4 py-3 text-sm text-slate-700">
            {t('publicOrder.status')} <b>{dispatchStatusLabel(data.dispatch.status)}</b>
          </div>
        )}

        {rejectOpen && (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <p className="font-medium">{t('publicOrder.rejectReason')}</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={3}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border px-4 py-2 text-sm"
                onClick={() => setRejectOpen(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white font-medium"
                onClick={() => void reject()}
              >
                {t('publicOrder.reject')}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border bg-white p-4">
          <ChatSection token={token!} senderType="supplier" />
        </div>
      </div>
    </div>
  );
}

