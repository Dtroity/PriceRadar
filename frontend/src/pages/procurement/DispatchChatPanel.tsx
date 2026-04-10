import { useEffect, useState } from 'react';
import { request } from '../../api/client';
import { cn } from '../../lib/cn';
import { useLocale } from '../../i18n/LocaleContext';

type Dispatch = {
  id: string;
  supplier: { id: string; name: string; email: string | null };
};

type Msg = {
  id: string;
  sender_type: 'supplier' | 'manager' | string;
  sender_name: string | null;
  message: string;
  created_at: string;
};

export default function DispatchChatPanel({
  open,
  dispatch,
  onClose,
  onChanged,
}: {
  open: boolean;
  dispatch: Dispatch | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, locale } = useLocale();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatchId = dispatch?.id ?? '';

  const fetchMessages = async () => {
    if (!dispatchId) return;
    setLoading(true);
    try {
      const r = await request<{ messages: Msg[] }>(`/procurement/dispatches/${dispatchId}/messages`);
      setMessages(r.messages ?? []);
      onChanged();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !dispatchId) return;
    void fetchMessages();
    const interval = window.setInterval(() => void fetchMessages(), 15000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dispatchId]);

  const send = async () => {
    if (!dispatchId || !text.trim()) return;
    await request(`/procurement/dispatches/${dispatchId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });
    setText('');
    await fetchMessages();
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
        aria-label={t('aria.dispatchChat')}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm text-slate-500">{t('chat.title')}</p>
            <p className="font-semibold text-slate-900">{dispatch?.supplier.name ?? '—'}</p>
          </div>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            {t('dispatchChat.close')}
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto" style={{ height: 'calc(100vh - 140px)' }}>
          {loading && messages.length === 0 ? (
            <div className="text-sm text-slate-500">{t('dispatchChat.loading')}</div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={[
                  'p-3 rounded-lg text-sm',
                  m.sender_type === 'manager' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8',
                ].join(' ')}
              >
                <p className="font-medium text-xs text-gray-500 mb-1">
                  {m.sender_name || (m.sender_type === 'supplier' ? t('chat.supplier') : t('chat.manager'))} ·{' '}
                  {new Date(m.created_at).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                </p>
                <p>{m.message}</p>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void send()}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('chat.messagePlaceholder')}
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => void send()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('chat.send')}
          </button>
        </div>
      </aside>
    </>
  );
}

