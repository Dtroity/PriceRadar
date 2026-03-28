import { Navigate } from 'react-router-dom';

/** Журнал загрузок перенесён в модуль «Скан» (`/documents`). */
export default function IngestionManagement() {
  return <Navigate to="/documents" replace />;
}
