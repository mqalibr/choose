import type { SimilarProductPreview } from "./types";

interface SimilarProductsProps {
  products: SimilarProductPreview[];
}

export function SimilarProducts({ products }: SimilarProductsProps) {
  if (!products.length) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
      <h3 className="mb-3 mt-0 text-[1.06rem] font-semibold text-slate-900">Oxşar məhsullar</h3>
      <div className="grid grid-flow-col gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(170px,220px)] snap-x snap-mandatory" role="region" aria-label="Oxşar məhsullar">
        {products.map((item) => (
          <a
            key={`${item.name}-${item.link}`}
            href={item.link}
            className="snap-start rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 flex flex-col gap-2 hover:border-[rgba(50,144,241,0.45)]"
          >
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="h-[130px] w-full rounded-lg border border-slate-200 bg-slate-100 object-cover"
            />
            <span className="text-sm font-semibold leading-[1.35]">{item.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
