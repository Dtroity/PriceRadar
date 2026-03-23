import { useLocale } from '../i18n/LocaleContext';
import type { Locale } from '../i18n/translations';

const LABELS: Record<Locale, string> = { ru: 'RU', en: 'EN' };

export default function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {(['ru', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`rounded-md px-3 py-2 min-h-[44px] min-w-[44px] text-xs font-medium transition-colors flex items-center justify-center ${
            locale === l
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          title={l === 'ru' ? 'Русский' : 'English'}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
