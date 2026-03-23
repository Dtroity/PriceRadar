import { Link } from 'react-router-dom';
import LocaleSwitcher from '../components/LocaleSwitcher';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Тарифы Vizor360</h1>
        <p className="text-slate-600 mb-8">Оплата онлайн — позже. Сейчас смена тарифа через администратора платформы.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-lg text-slate-800">Free</h2>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              <li>До 3 пользователей</li>
              <li>До 50 документов / мес</li>
              <li>Аналитика и аномалии</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-slate-800 p-5 shadow-md ring-2 ring-slate-800">
            <h2 className="font-semibold text-lg text-slate-800">Pro</h2>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              <li>До 10 пользователей</li>
              <li>До 500 документов / мес</li>
              <li>Закупки, рекомендации</li>
              <li>Email и Web Push</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-lg text-slate-800">Enterprise</h2>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              <li>Без лимитов</li>
              <li>Все модули</li>
              <li>VK Notify, iiko, AI</li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center">
          <Link to="/register" className="text-slate-800 font-medium underline">
            Зарегистрировать организацию
          </Link>
          {' · '}
          <Link to="/login" className="text-slate-600 underline">
            Вход
          </Link>
        </p>
      </div>
    </div>
  );
}
