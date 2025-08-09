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
