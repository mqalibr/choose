import Link from "next/link";

interface PaginationProps {
  basePath: string;
  page: number;
  total: number;
  limit: number;
  query?: Record<string, string | undefined>;
}

function buildPageHref(
  basePath: string,
  targetPage: number,
  query: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (!value) continue;
    if (key === "page") continue;
    params.set(key, value);
  }

  if (targetPage > 1) {
    params.set("page", String(targetPage));
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function buildPageList(current: number, total: number): Array<number | "..."> {
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);

  for (let i = current - 2; i <= current + 2; i += 1) {
    if (i > 1 && i < total) pages.add(i);
  }

  if (current <= 4) {
    for (let i = 2; i <= 5; i += 1) pages.add(i);
  }

  if (current >= total - 3) {
    for (let i = total - 4; i <= total - 1; i += 1) pages.add(i);
  }

  const sorted = [...pages].filter((x) => x >= 1 && x <= total).sort((a, b) => a - b);
  const result: Array<number | "..."> = [];

  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("...");
    }
    result.push(sorted[i]);
  }

  return result;
}

export function Pagination({ basePath, page, total, limit, query = {} }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const current = Math.max(1, Math.min(page, totalPages));
  const pages = buildPageList(current, totalPages);

  return (
    <nav className="pagination" aria-label="Səhifələmə">
      {current > 1 ? (
        <Link className="pagination-link" href={buildPageHref(basePath, current - 1, query)}>
          Geri
        </Link>
      ) : (
        <span className="pagination-link is-disabled">Geri</span>
      )}

      {pages.map((entry, idx) => {
        if (entry === "...") {
          return (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
              ...
            </span>
          );
        }

        const isActive = entry === current;
        if (isActive) {
          return (
            <span key={`page-${entry}`} className="pagination-link is-active">
              {entry}
            </span>
          );
        }

        return (
          <Link
            key={`page-${entry}`}
            className="pagination-link"
            href={buildPageHref(basePath, entry, query)}
          >
            {entry}
          </Link>
        );
      })}

      {current < totalPages ? (
        <Link className="pagination-link" href={buildPageHref(basePath, current + 1, query)}>
          İrəli
        </Link>
      ) : (
        <span className="pagination-link is-disabled">İrəli</span>
      )}
    </nav>
  );
}
