import type { ProductPricePoint } from "./types";

interface PriceChartProps {
  history: ProductPricePoint[];
}

function formatDate(value: string): string {
  const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (direct) {
    return `${direct[3]}.${direct[2]}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

export function PriceChart({ history }: PriceChartProps) {
  const points = history.filter((item) => Number.isFinite(item.price));

  if (!points.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
        <h3 className="mb-3 mt-0 text-[1.06rem] font-semibold text-slate-900">Qiymət tarixi</h3>
        <div className="grid min-h-[120px] place-items-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
          Hələ qiymət tarixçəsi yoxdur.
        </div>
      </section>
    );
  }

  const min = Math.min(...points.map((p) => p.price));
  const max = Math.max(...points.map((p) => p.price));
  const range = Math.max(1, max - min);

  const svgPoints = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 100;
      const y = 100 - ((point.price - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
      <h3 className="mb-3 mt-0 text-[1.06rem] font-semibold text-slate-900">Qiymət tarixi</h3>
      <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3" aria-label="Qiymət tarixçəsi qrafiki">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" className="block h-[220px] w-full">
          <polyline points={svgPoints} className="fill-none stroke-teal-700 stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]" />
          {points.map((point, index) => {
            const x = (index / Math.max(1, points.length - 1)) * 100;
            const y = 100 - ((point.price - min) / range) * 100;
            return <circle key={`${point.date}-${point.price}`} cx={x} cy={y} r="1.8" className="fill-teal-700" />;
          })}
        </svg>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span>{formatDate(points[0]?.date)}</span>
          <span>{formatDate(points[points.length - 1]?.date)}</span>
        </div>
      </div>
    </section>
  );
}
