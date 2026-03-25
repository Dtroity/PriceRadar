import { Routes, Route, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { useAuth } from './auth/AuthContext';
import { useT } from './i18n/LocaleContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Pricing from './pages/Pricing';
import Admin from './pages/Admin';
import AdminOrgDetail from './pages/AdminOrgDetail';
import NotificationsSettings from './pages/NotificationsSettings';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import Forecast from './pages/Forecast';
import FoodCost from './pages/FoodCost';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import TelegramAdmin from './pages/TelegramAdmin';
import ProcurementRecommendations from './pages/procurement/Recommendations';
import ProcurementOrders from './pages/procurement/Orders';
import Procurement from './pages/procurement/Procurement';
import OrderDetail from './pages/procurement/OrderDetail';
import ProcurementSuppliers from './pages/procurement/Suppliers';
import AutomationRules from './pages/procurement/AutomationRules';
import StockOverview from './pages/stock/StockOverview';
import StockForecast from './pages/stock/StockForecast';
import AutopilotRecommendations from './pages/stock/AutopilotRecommendations';
import Analytics from './pages/Analytics';
import AnomaliesPage from './pages/analytics/Anomalies';
import PublicOrderPage from './pages/public/OrderPage';
import EmployeePage from './pages/Employee';

function ErrorFallback() {
  const t = useT();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6">
      <p className="text-slate-800 font-medium">{t('common.error')}</p>
      <button
        type="button"
        className="rounded-lg bg-slate-800 px-4 py-2 text-white text-sm"
        onClick={() => window.location.assign('/')}
      >
        {t('nav.dashboard')}
      </button>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const t = useT();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">{t('common.loading')}</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/order/:token" element={<PublicOrderPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/employee" element={<EmployeePage />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/:id" element={<DocumentDetail />} />
                <Route path="/prices" element={<Dashboard />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/foodcost" element={<FoodCost />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/products" element={<Products />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/notifications" element={<NotificationsSettings />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/org/:id" element={<AdminOrgDetail />} />
                <Route path="/telegram" element={<TelegramAdmin />} />
                <Route path="/procurement" element={<Procurement />} />
                <Route path="/procurement/recommendations" element={<ProcurementRecommendations />} />
                <Route path="/procurement/orders" element={<ProcurementOrders />} />
                <Route path="/procurement/orders/:id" element={<OrderDetail />} />
                <Route path="/procurement/suppliers" element={<ProcurementSuppliers />} />
                <Route path="/procurement/rules" element={<AutomationRules />} />
                <Route path="/stock" element={<StockOverview />} />
                <Route path="/stock/forecast" element={<StockForecast />} />
                <Route path="/stock/autopilot" element={<AutopilotRecommendations />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/analytics/anomalies" element={<AnomaliesPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </Sentry.ErrorBoundary>
  );
}
