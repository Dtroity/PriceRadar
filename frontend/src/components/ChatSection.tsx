import { useEffect, useMemo, useState } from 'react';

type Msg = {
  id: string;
  sender_type: 'supplier' | 'manager' | string;
  sender_name: string | null;
  message: string;
  created_at: string;
};

export function ChatSection({
  token,
  senderType,
}: {
  token: string;
  senderType: 'supplier' | 'manager';
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [senderName, setSenderName] = useState('');
  const [sending, setSending] = useState(false);

  const apiBase = useMemo(() => `/api/public/order/${encodeURIComponent(token)}`, [token]);

  const fetchMessages = async () => {
    const res = await fetch(`${apiBase}/messages`);
    if (!res.ok) return;
    const data = (await res.json()) as { messages: Msg[] };
    setMessages(Array.isArray(data.messages) ? data.messages : []);
  };

  useEffect(() => {
    void fetchMessages();
    const interval = window.setInterval(() => void fetchMessages(), 15000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sender_name: senderType === 'supplier' ? senderName : undefined }),
      });
      if (!res.ok) return;
      setText('');
      await fetchMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t pt-4">
      <h3 className="font-medium mb-3">Переписка</h3>
      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={[
              'p-3 rounded-lg text-sm',
              m.sender_type === senderType ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8',
            ].join(' ')}
          >
            <p className="font-medium text-xs text-gray-500 mb-1">
              {m.sender_name || (m.sender_type === 'supplier' ? 'Поставщик' : 'Менеджер')} ·{' '}
              {new Date(m.created_at).toLocaleString('ru-RU')}
            </p>
            <p>{m.message}</p>
          </div>
        ))}
      </div>
      {senderType === 'supplier' && (
        <input
          placeholder="Ваше имя (необязательно)"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 mb-2 text-sm"
        />
      )}
      <div className="flex gap-2">
        <input
          placeholder="Сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => void send()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Отправить
        </button>
      </div>
    </div>
  );
}

