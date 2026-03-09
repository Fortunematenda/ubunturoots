import Link from 'next/link';

export default async function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ubuntu-green/10 via-white to-ubuntu-gold/15" />
      <div className="relative flex min-h-[calc(100vh-72px)] w-full flex-col justify-center px-4 py-6 md:px-10">
        <section className="w-full max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-ubuntu-gold">Ubuntu Roots</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-ubuntu-green md:text-5xl">Our Family. Our Strength.</h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            A respectful and transparent platform for member records, funeral contributions, and heritage preservation.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary">
              Get started
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
