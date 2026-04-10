import { useState, useRef } from 'react';
import { api } from '../api/client';
import { useT } from '../i18n/LocaleContext';

interface UploadZoneProps {
  onUpload?: () => void;
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const t = useT();
  const [drag, setDrag] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      await api.upload(file, supplierName || t('upload.unknownSupplier'), 'web');
      setMessage({ type: 'ok', text: t('upload.queued') });
      setSupplierName('');
      if (inputRef.current) inputRef.current.value = '';
      onUpload?.();
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : t('upload.failed'),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        drag ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,.csv,.pdf,.doc,.docx,image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <input
        type="text"
        placeholder={t('upload.supplierPlaceholder')}
        value={supplierName}
        onChange={(e) => setSupplierName(e.target.value)}
        className="mb-3 w-full max-w-xs mx-auto px-3 py-2 border border-slate-300 rounded-lg text-sm block"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
      >
        {uploading ? t('upload.uploading') : t('upload.chooseFile')}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        {t('upload.formats')}
      </p>
      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === 'ok' ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
