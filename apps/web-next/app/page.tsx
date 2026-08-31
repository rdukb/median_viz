import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Median Viz — Pastel UI</h1>
          <p className="text-[var(--muted)] mt-1">
            Explore animated charts with Next.js + Tailwind + Plotly.
          </p>
        </header>

        <Link
          href="/studio"
          className="mb-6 block rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-pink-50 to-amber-50 p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">New prototype</div>
          <h2 className="mt-2 text-xl font-semibold">Open the exploratory Studio</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Explore representative LinkedIn B2B audience performance data with independent pivots and shared human/agent controls.
          </p>
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/pie" className="card p-6 hover:shadow-lg transition">
            <h2 className="font-semibold mb-2">Animated Pie (Revenue)</h2>
            <p className="text-sm text-[var(--muted)]">By year, pastel colors, slider + play.</p>
          </Link>
          <Link href="/bar" className="card p-6 hover:shadow-lg transition">
            <h2 className="font-semibold mb-2">Bar Race</h2>
            <p className="text-sm text-[var(--muted)]">Top categories over time.</p>
          </Link>
          <Link href="/map" className="card p-6 hover:shadow-lg transition">
            <h2 className="font-semibold mb-2">US Map (Median Income)</h2>
            <p className="text-sm text-[var(--muted)]">Animated by year.</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
