import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { useT } from './i18n/LocaleContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
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
import ProcurementSuppliers from './pages/procurement/Suppliers';
import AutomationRules from './pages/procurement/AutomationRules';
import StockOverview from './pages/stock/StockOverview';
import StockForecast from './pages/stock/StockForecast';
import AutopilotRecommendations from './pages/stock/AutopilotRecommendations';

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
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/:id" element={<DocumentDetail />} />
                <Route path="/prices" element={<Dashboard />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/foodcost" element={<FoodCost />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/products" element={<Products />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/telegram" element={<TelegramAdmin />} />
                <Route path="/procurement" element={<ProcurementRecommendations />} />
                <Route path="/procurement/recommendations" element={<ProcurementRecommendations />} />
                <Route path="/procurement/orders" element={<ProcurementOrders />} />
                <Route path="/procurement/suppliers" element={<ProcurementSuppliers />} />
                <Route path="/procurement/rules" element={<AutomationRules />} />
                <Route path="/stock" element={<StockOverview />} />
                <Route path="/stock/forecast" element={<StockForecast />} />
                <Route path="/stock/autopilot" element={<AutopilotRecommendations />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
