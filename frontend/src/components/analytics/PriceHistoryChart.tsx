import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PriceHistoryResponse } from '../../api/analyticsClient';

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4d7c0f'];

type Props = {
  data: PriceHistoryResponse | null;
  loading: boolean;
  emptyMessage: string;
};

export default function PriceHistoryChart({ data, loading, emptyMessage }: Props) {
  const navigate = useNavigate();

  const { chartData, lineKeys } = useMemo(() => {
    if (!data?.series?.length) return { chartData: [] as Record<string, unknown>[], lineKeys: [] as string[] };

    const dateSet = new Set<string>();
    for (const s of data.series) {
      for (const p of s.points) dateSet.add(p.date);
    }
    const sortedDates = [...dateSet].sort();
    const lineKeys = data.series.map((s) => s.supplier.name);

    const chartData = sortedDates.map((date) => {
      const row: Record<string, unknown> = { date };
      for (const s of data.series) {
        const pt = s.points.find((x) => x.date === date);
        if (pt) row[s.supplier.name] = pt.price;
      }
      return row;
    });

    return { chartData, lineKeys };
  }, [data]);

  if (loading) {
    return (
      <div className="h-80 rounded-xl border border-slate-200 bg-slate-50 animate-pulse flex items-center justify-center text-slate-500 text-sm">
        …
      </div>
    );
  }

  if (!data || !chartData.length) {
    return (
      <div className="h-80 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 text-sm px-4 text-center">
        {emptyMessage}
      </div>
    );
  }

  const handleDotClick = (supplierName: string, date: string) => {
    if (!data) return;
    const s = data.series.find((x) => x.supplier.name === supplierName);
    const pt = s?.points.find((p) => p.date === date);
    if (pt?.document_id) navigate(`/documents/${pt.document_id}`);
  };

  return (
    <div className="space-y-4">
      <div className="h-80 w-full min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
            <YAxis tick={{ fontSize: 11 }} stroke="#64748b" domain={['auto', 'auto']} />
            <Tooltip
              formatter={(v) => [
                typeof v === 'number' ? v.toFixed(2) : String(v ?? ''),
                '',
              ]}
              labelFormatter={(l) => `Дата: ${l}`}
            />
            <Legend />
            {lineKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const date = payload?.date as string | undefined;
                  if (date == null || cx == null || cy == null) return <circle r={0} />;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={PALETTE[i % PALETTE.length]}
                      className="cursor-pointer hover:r-6"
                      onClick={() => handleDotClick(key, date)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDotClick(key, date);
                      }}
                      role="button"
                      tabIndex={0}
                    />
                  );
                }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
          <div className="text-slate-500 text-xs">Min</div>
          <div className="font-medium">{data.stats.min_price.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
          <div className="text-slate-500 text-xs">Max</div>
          <div className="font-medium">{data.stats.max_price.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
          <div className="text-slate-500 text-xs">Avg</div>
          <div className="font-medium">{data.stats.avg_price.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
          <div className="text-slate-500 text-xs">Δ %</div>
          <div className="font-medium">{data.stats.price_change_pct.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}
