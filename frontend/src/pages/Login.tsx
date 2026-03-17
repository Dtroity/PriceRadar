import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import LocaleSwitcher from '../components/LocaleSwitcher';

export default function Login() {
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithOrg } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (organizationSlug.trim()) {
        await loginWithOrg?.(organizationSlug.trim(), email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
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
        <h1 className="text-2xl font-semibold text-slate-800 text-center mb-1">
          {t('app.name')}
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">{t('app.tagline')}</p>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('auth.workspaceSlug')}
          </label>
          <input
            type="text"
            placeholder={t('auth.workspacePlaceholder')}
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
          />
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('auth.email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
            required
          />
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('auth.password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-6 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
          <p className="mt-3 text-center text-sm text-slate-500">
            {t('auth.registerLink')} <Link to="/register" className="text-slate-700 underline">{t('auth.register')}</Link>
          </p>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          {t('app.poweredBy')}
        </p>
      </div>
    </div>
  );
}
