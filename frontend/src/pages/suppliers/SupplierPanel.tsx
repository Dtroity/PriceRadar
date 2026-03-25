import { useEffect, useMemo, useState } from 'react';
import { api, type Supplier } from '../../api/client';
import { cn } from '../../lib/cn';

type Filter = { id: string; keyword: string };

export default function SupplierPanel({
  open,
  supplier,
  onClose,
  onSupplierUpdated,
}: {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSupplierUpdated: (s: Supplier) => void;
}) {
  const [tab, setTab] = useState<'contacts' | 'filters'>('contacts');
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyChannel, setNotifyChannel] = useState<'email' | 'telegram' | 'both' | 'none'>('email');
  const [isActive, setIsActive] = useState(true);

  const [filters, setFilters] = useState<Filter[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    if (!supplier) return;
    setContactName(String(supplier.contact_name ?? ''));
    setEmail(String(supplier.email ?? ''));
    setPhone(String(supplier.phone ?? ''));
    setNotifyChannel((supplier.notify_channel as any) || 'email');
    setIsActive(Boolean(supplier.is_active ?? true));
  }, [supplier]);

  const supplierId = supplier?.id ?? '';

  const loadFilters = async () => {
    if (!supplierId) return;
    setFiltersLoading(true);
    try {
      const r = await api.supplier.filters.list(supplierId);
      setFilters(r.filters ?? []);
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !supplierId) return;
    if (tab === 'filters') void loadFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierId, tab]);

  const canInvite = useMemo(() => Boolean(email.trim()), [email]);

  const save = async () => {
    if (!supplier) return;
    setSaving(true);
    try {
      const updated = await api.supplier.patch(supplier.id, {
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        notify_channel: notifyChannel,
        is_active: isActive,
      });
      onSupplierUpdated(updated);
    } finally {
      setSaving(false);
    }
  };

  const invite = async () => {
    if (!supplier) return;
    setInviting(true);
    try {
      await api.supplier.invite(supplier.id);
    } finally {
      setInviting(false);
    }
  };

  const addKeyword = async () => {
    const kw = newKeyword.trim();
    if (!kw || !supplierId) return;
    const created = await api.supplier.filters.add(supplierId, kw);
    setFilters((prev) => {
      if (prev.some((p) => p.id === created.id)) return prev;
      if (prev.some((p) => p.keyword.toLowerCase() === created.keyword.toLowerCase())) return prev;
      return [...prev, created].sort((a, b) => a.keyword.localeCompare(b.keyword, 'ru'));
    });
    setNewKeyword('');
  };

  const removeKeyword = async (filterId: string) => {
    if (!supplierId) return;
    await api.supplier.filters.remove(supplierId, filterId);
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/30 transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 h-screen w-full max-w-md bg-white shadow-xl border-l border-slate-200 transition-transform',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Supplier panel"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm text-slate-500">Поставщик</p>
            <p className="font-semibold text-slate-900">{supplier?.name ?? '—'}</p>
          </div>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('contacts')}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-medium border',
                tab === 'contacts' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'
              )}
            >
              Контакты
            </button>
            <button
              type="button"
              onClick={() => setTab('filters')}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-medium border',
                tab === 'filters' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'
              )}
            >
              Фильтры
            </button>
          </div>
        </div>

        {tab === 'contacts' ? (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Контактное лицо</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Имя"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="email@example.com"
              />
              <p className="mt-1 text-xs text-slate-500">Email обязателен для отправки заказов по почте</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="+7…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Канал уведомлений</label>
              <select
                value={notifyChannel}
                onChange={(e) => setNotifyChannel(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
                <option value="both">Оба</option>
                <option value="none">Не уведомлять</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Активен
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={!canInvite || inviting}
                onClick={() => void invite()}
                className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Пригласить зарегистрироваться
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="flex-1 rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <p className="text-sm text-slate-600 mb-3">
              Позиции заказа с этими словами в названии будут направляться этому поставщику
            </p>

            {filtersLoading ? (
              <div className="text-sm text-slate-500">Загрузка…</div>
            ) : filters.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Добавьте ключевые слова чтобы заказы автоматически распределялись этому поставщику
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {filters.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                  >
                    {f.keyword}
                    <button
                      type="button"
                      onClick={() => void removeKeyword(f.id)}
                      className="text-slate-500 hover:text-slate-900"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addKeyword()}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ключевое слово…"
              />
              <button
                type="button"
                onClick={() => void addKeyword()}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
              >
                Добавить
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

