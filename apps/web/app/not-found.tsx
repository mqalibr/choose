import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card">
      <h2>Səhifə tapılmadı</h2>
      <p className="muted">Link köhnəlmiş və ya səhv ola bilər.</p>
      <Link href="/">Ana səhifəyə qayıt</Link>
    </section>
  );
}
