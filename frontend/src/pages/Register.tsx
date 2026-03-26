import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import LocaleSwitcher from '../components/LocaleSwitcher';
import { Logo } from '../components/layout/Logo';

const INDUSTRIES = [
  { value: '', label: '— выберите —' },
  { value: 'restaurant', label: 'Ресторан' },
  { value: 'cafe', label: 'Кафе' },
  { value: 'retail', label: 'Магазин' },
  { value: 'production', label: 'Производство' },
];

export default function Register() {
  const [organizationName, setOrganizationName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerOrg } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerOrg?.(
        organizationName,
        slug || organizationName.toLowerCase().replace(/\s+/g, '-'),
        email,
        password,
        industry || undefined
      );
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-800 text-center mb-1">
          Создать аккаунт Vizor360
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">{t('app.tagline')}</p>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
          )}
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.organizationName')}</label>
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
            required
          />
          <label className="block text-sm font-medium text-slate-700 mb-1">Сфера деятельности</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4 bg-white"
          >
            {INDUSTRIES.map((o) => (
              <option key={o.value || '_'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.workspaceSlugLabel')}</label>
          <input
            type="text"
            placeholder={t('auth.workspacePlaceholder')}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
            required
          />
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
            required
          />
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-6"
            required
          />
          <p className="text-xs text-slate-600 mb-4 p-2 bg-slate-50 rounded-lg border border-slate-100">
            Вы начинаете с тарифа <strong>Free</strong>. Расширение — через администратора или{' '}
            <Link to="/pricing" className="underline">
              тарифы
            </Link>
            .
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? t('auth.creating') : t('auth.createWorkspace')}
          </button>
          <p className="mt-3 text-center text-sm text-slate-500">
            {t('auth.haveAccount')} <Link to="/login" className="text-slate-700 underline">{t('auth.signInLink')}</Link>
          </p>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">{t('app.poweredBy')}</p>
      </div>
    </div>
  );
}
