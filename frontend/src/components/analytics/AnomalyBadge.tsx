import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUnreadAnomalyCount } from '../../api/analyticsClient';

export default function AnomalyBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnreadAnomalyCount()
      .then((r) => {
        if (!cancelled) setCount(r.count);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null || count === 0) {
    return (
      <Link to="/analytics/anomalies" className="text-slate-600 hover:text-slate-900 text-sm">
        Аномалии
      </Link>
    );
  }

  return (
    <Link
      to="/analytics/anomalies"
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200"
    >
      Аномалии
      <span className="rounded-full bg-amber-200 px-1.5">{count}</span>
    </Link>
  );
}
