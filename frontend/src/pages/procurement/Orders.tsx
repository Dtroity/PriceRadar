import { Navigate } from 'react-router-dom';

/** Legacy path: /procurement/orders → main procurement hub */
export default function ProcurementOrders() {
  return <Navigate to="/procurement" replace />;
}
