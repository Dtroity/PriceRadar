import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-slate-800">
          PriceRadar
        </Link>
        <div className="flex items-center gap-4">
          {user?.role === 'admin' && (
            <Link to="/telegram" className="text-sm text-slate-600 hover:text-slate-900">
              Telegram
            </Link>
          )}
          <span className="text-sm text-slate-500">{user?.email}</span>
          <span className="text-xs text-slate-400 uppercase">{user?.role}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
      <footer className="py-3 px-4 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400/80">
          Powered by <span className="font-medium text-slate-500">VizoR360</span>
        </p>
      </footer>
    </div>
  );
}
