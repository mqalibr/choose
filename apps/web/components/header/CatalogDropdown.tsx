"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface CatalogCategory {
  slug: string;
  name: string;
}

interface CatalogDropdownProps {
  categories: CatalogCategory[];
}

export function CatalogDropdown({ categories }: CatalogDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activePrimary, setActivePrimary] = useState<"electronics" | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActivePrimary(null);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setActivePrimary(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const isSubmenuVisible = activePrimary === "electronics";

  return (
    <div className={`catalog-dropdown${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="catalog-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((prev) => !prev);
          if (open) {
            setActivePrimary(null);
          }
        }}
      >
        <span aria-hidden>{"▦"}</span>
        Kataloq
      </button>

      {open ? (
        <div
          className={`catalog-panel${isSubmenuVisible ? " is-submenu-open" : ""}`}
          role="menu"
          onMouseLeave={() => setActivePrimary(null)}
        >
          <nav className="catalog-panel-col" aria-label="Əsas kateqoriya">
            <ul className="catalog-menu-list">
              <li>
                <Link
                  className={`catalog-menu-link${isSubmenuVisible ? " is-active" : ""}`}
                  href="/search?q=elektronika"
                  onMouseEnter={() => setActivePrimary("electronics")}
                  onFocus={() => setActivePrimary("electronics")}
                >
                  <span className="catalog-item-icon">EL</span>
                  <span className="catalog-item-name">Elektronika</span>
                  <span className="catalog-item-arrow">{">"}</span>
                </Link>
              </li>
            </ul>
          </nav>

          {isSubmenuVisible ? (
            <nav className="catalog-panel-col" aria-label="Elektronika alt kateqoriyaları">
              <ul className="catalog-menu-list">
                {categories.map((item) => (
                  <li key={item.slug}>
                    <Link
                      className="catalog-menu-link catalog-menu-link--simple"
                      href={`/category/${item.slug}`}
                      onClick={() => {
                        setOpen(false);
                        setActivePrimary(null);
                      }}
                    >
                      <span className="catalog-item-name">{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
