import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QiymətRadar - Azərbaycan Elektronika Qiymət Müqayisəsi",
  description: "Telefon, noutbuk, TV və digər elektronika üçün mağazalararası qiymət müqayisəsi.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>
        <main>
          <header style={{ marginBottom: 20 }}>
            <h1 style={{ marginBottom: 8 }}>QiymətRadar</h1>
            <p className="muted" style={{ marginTop: 0 }}>
              Azərbaycan bazarı üçün elektronika qiymət müqayisəsi
            </p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
