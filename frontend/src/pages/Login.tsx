import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import LocaleSwitcher from '../components/LocaleSwitcher';
import { Logo } from '../components/layout/Logo';

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
      let u: { role?: string } | null = null;
      if (organizationSlug.trim()) {
        u = (await loginWithOrg?.(organizationSlug.trim(), email, password)) ?? null;
      } else {
        u = await login(email, password);
      }
      if (u?.role === 'employee') navigate('/employee');
      else navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid bg-slate-50 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-[#0F0F1A] p-12 text-white">
        <Logo size="md" />
        <div>
          <h1 className="mb-6 text-4xl font-semibold leading-tight">
            Полный контроль
            <br />
            закупок и цен
          </h1>
          <ul className="space-y-3 text-zinc-400">
            <li className="flex gap-3"><span className="text-indigo-500">✦</span>Автоматическое распознавание накладных</li>
            <li className="flex gap-3"><span className="text-indigo-500">✦</span>Мониторинг цен и аномалий в реальном времени</li>
            <li className="flex gap-3"><span className="text-indigo-500">✦</span>AI-рекомендации по закупкам</li>
          </ul>
        </div>
        <p className="text-xs text-zinc-600">© 2025 Vizor360. Все права защищены.</p>
      </div>

      <div className="relative flex items-center justify-center p-8">
        <div className="absolute right-4 top-4">
          <LocaleSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size="md" />
          </div>
          <h2 className="mb-1 text-2xl font-semibold text-slate-900">Вход в систему</h2>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">Введите данные вашей организации</p>
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
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
            className="w-full rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
          <p className="mt-3 text-center text-sm text-slate-500">
            {t('auth.registerLink')} <Link to="/register" className="text-slate-700 underline">{t('auth.register')}</Link>
          </p>
          </form>
          <p className="mt-4 text-center text-xs text-slate-400">{t('app.poweredBy')}</p>
        </div>
      </div>
    </div>
  );
}
