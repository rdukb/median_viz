'use client'
import { useMemo, useState } from 'react'
import ClientPlot from '@/components/ClientPlot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CSVUpload from '@/components/CSVUpload'

type Row = { year: string | number; abbr: string; value: number }

const sample: Row[] = [
  { year: 2021, abbr: 'CA', value: 72000 },
  { year: 2021, abbr: 'TX', value: 60000 },
  { year: 2021, abbr: 'NY', value: 68000 },
  { year: 2021, abbr: 'FL', value: 56000 },
  { year: 2021, abbr: 'WA', value: 70000 },
  { year: 2022, abbr: 'CA', value: 74000 },
  { year: 2022, abbr: 'TX', value: 62000 },
  { year: 2022, abbr: 'NY', value: 69500 },
  { year: 2022, abbr: 'FL', value: 57500 },
  { year: 2022, abbr: 'WA', value: 71500 },
  { year: 2023, abbr: 'CA', value: 76000 },
  { year: 2023, abbr: 'TX', value: 63500 },
  { year: 2023, abbr: 'NY', value: 71000 },
  { year: 2023, abbr: 'FL', value: 59000 },
  { year: 2023, abbr: 'WA', value: 73000 },
  { year: 2024, abbr: 'CA', value: 78000 },
  { year: 2024, abbr: 'TX', value: 65000 },
  { year: 2024, abbr: 'NY', value: 72500 },
  { year: 2024, abbr: 'FL', value: 60500 },
  { year: 2024, abbr: 'WA', value: 74500 },
]

export default function MapPage() {
  const [rows, setRows] = useState<Row[]>(sample)

  const years = useMemo(
    () => Array.from(new Set(rows.map(r => String(r.year)))).sort(),
    [rows]
  )

  const frames = useMemo(() => {
    const zmin = Math.min(...rows.map(r => r.value))
    const zmax = Math.max(...rows.map(r => r.value))
    return years.map(y => {
      const subset = rows.filter(r => String(r.year) === y)
      return {
        name: y,
        data: [{
          type: 'choropleth' as const,
          locationmode: 'USA-states' as const,
          locations: subset.map(s => s.abbr),
          z: subset.map(s => s.value),
          colorscale: 'Viridis',
          zmin, zmax,
          colorbar: { title: 'Income' },
        }]
      }
    })
  }, [years, rows])

  const layout: any = {
    title: 'Median Household Income — Animated (USA)',
    geo: { scope: 'usa' },
    template: 'plotly_white',
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { color: '#222', size: 14 },
    margin: { l: 10, r: 10, t: 60, b: 10 },
    updatemenus: [{
      type: 'buttons', showactive: false, x: 0.02, y: 1.15, xanchor: 'left', yanchor: 'top',
      buttons: [
        { label: '▶ Play', method: 'animate', args: [null, { frame: { duration: 700, redraw: true }, transition: { duration: 400 }, fromcurrent: true }] },
        { label: '⏸ Pause', method: 'animate', args: [[null], { mode: 'immediate', frame: { duration: 0, redraw: false }, transition: { duration: 0 } }] },
      ]
    }],
    sliders: [{
      active: 0, x: 0.1, y: 0.02, len: 0.8,
      currentvalue: { prefix: 'Year: ', font: { size: 16, color: '#222' } },
      steps: years.map(y => ({
        label: y, method: 'animate',
        args: [[y], { mode: 'immediate', frame: { duration: 0, redraw: true }, transition: { duration: 0 } }]
      }))
    }]
  }

  const onUpload = (arr: any[]) => {
    // normalize keys: lower-case + trimmed
    const norm = (obj: any) =>
      Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [String(k).toLowerCase().trim(), v])
      )

    const cleaned = arr
      .map((raw) => {
        const r = norm(raw)
        const year = r.year ?? r.fiscal_year ?? r.yr
        const abbr = r.abbr ?? r.state_abbr ?? r.statecode
        // accept either "value" or "median_income"
        const valueRaw = r.value ?? r.median_income ?? r.income
        const value = Number(valueRaw)
        return { year, abbr: abbr ? String(abbr).toUpperCase() : '', value }
      })
      .filter((r) => r.year != null && r.abbr && Number.isFinite(r.value))

    setRows(cleaned as any)
  }


  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Card>
          <CardHeader><CardTitle>US Median Income (Sample)</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4">
              <CSVUpload onData={onUpload} sampleHint="CSV columns: year, abbr, value" />
            </div>
            {frames.length > 0 ? (
              <ClientPlot
                data={frames[0].data as any}
                frames={frames as any}
                layout={layout}
                config={{ displayModeBar: false, scrollZoom: false, responsive: true }}
                className="w-full"
              />
            ) : (
              <div className="text-sm text-gray-500">No data to display.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
