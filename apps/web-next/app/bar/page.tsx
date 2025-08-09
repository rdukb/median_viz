'use client'
import { useMemo, useState } from 'react'
import ClientPlot from '@/components/ClientPlot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CSVUpload from '@/components/CSVUpload'

type Row = { time: string; category: string; value: number }

const sample: Row[] = [
  { time: '2024-01', category: 'Cozy Anime', value: 180 },
  { time: '2024-01', category: 'Stand-up Comedy', value: 140 },
  { time: '2024-01', category: 'DIY Shorts', value: 120 },
  { time: '2024-01', category: 'Food Vlogs', value: 110 },
  { time: '2024-01', category: 'True Crime', value: 90 },
  { time: '2024-02', category: 'Cozy Anime', value: 195 },
  { time: '2024-02', category: 'Stand-up Comedy', value: 150 },
  { time: '2024-02', category: 'DIY Shorts', value: 130 },
  { time: '2024-02', category: 'Food Vlogs', value: 125 },
  { time: '2024-02', category: 'True Crime', value: 100 },
  { time: '2024-03', category: 'Cozy Anime', value: 200 },
  { time: '2024-03', category: 'Stand-up Comedy', value: 165 },
  { time: '2024-03', category: 'DIY Shorts', value: 150 },
  { time: '2024-03', category: 'Food Vlogs', value: 140 },
  { time: '2024-03', category: 'True Crime', value: 105 },
  { time: '2024-04', category: 'Cozy Anime', value: 210 },
  { time: '2024-04', category: 'Stand-up Comedy', value: 170 },
  { time: '2024-04', category: 'DIY Shorts', value: 160 },
  { time: '2024-04', category: 'Food Vlogs', value: 150 },
  { time: '2024-04', category: 'True Crime', value: 110 },
]

export default function BarPage() {
  const [rows, setRows] = useState<Row[]>(sample)

  const times = useMemo(() => Array.from(new Set(rows.map(r => r.time))).sort(), [rows])
  const categories = useMemo(() => Array.from(new Set(rows.map(r => r.category))).sort(), [rows])
  const maxVal = useMemo(() => (rows.length ? Math.max(...rows.map(r => r.value)) * 1.15 : 1), [rows])

  const frames = useMemo(() => {
    return times.map(t => {
      const per = categories.map(c => rows.find(r => r.time === t && r.category === c)?.value ?? 0)
      return {
        name: t,
        data: [{
          type: 'bar' as const,
          orientation: 'h' as const,
          x: per,
          y: categories,
          text: per.map(v => v.toLocaleString()),
          textposition: 'outside',
          cliponaxis: false
        }]
      }
    })
  }, [times, categories, rows])

  const layout: any = {
    title: 'Top Categories Over Time — Bar Race',
    template: 'plotly_white',
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { color: '#222', size: 14 },
    margin: { l: 90, r: 20, t: 60, b: 40 },
    xaxis: { range: [0, maxVal], gridcolor: '#e5e7eb', title: 'Value' },
    yaxis: { gridcolor: '#f3f4f6' },
    showlegend: false,
    updatemenus: [{
      type: 'buttons', showactive: false, x: 0.02, y: 1.15, xanchor: 'left', yanchor: 'top',
      buttons: [
        { label: '▶ Play', method: 'animate', args: [null, { frame: { duration: 600, redraw: true }, transition: { duration: 350 }, fromcurrent: true }] },
        { label: '⏸ Pause', method: 'animate', args: [[null], { mode: 'immediate', frame: { duration: 0, redraw: false }, transition: { duration: 0 } }] },
      ]
    }],
    sliders: [{
      active: 0, x: 0.1, y: 0.02, len: 0.8,
      currentvalue: { prefix: 'Time: ', font: { size: 16, color: '#222' } },
      steps: times.map(t => ({
        label: t, method: 'animate',
        args: [[t], { mode: 'immediate', frame: { duration: 0, redraw: true }, transition: { duration: 0 } }]
      }))
    }]
  }

  const onUpload = (arr: any[]) => {
    const cleaned = arr
      .map(r => ({ time: String(r.time ?? ''), category: String(r.category ?? ''), value: Number(r.value ?? NaN) }))
      .filter(r => r.time && r.category && Number.isFinite(r.value))
    setRows(cleaned)
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Card>
          <CardHeader><CardTitle>Animated Bar Race</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4">
              <CSVUpload onData={onUpload} sampleHint="CSV columns: time, category, value" />
            </div>
            {frames.length > 0 ? (
              <ClientPlot
                data={frames[0].data as any}
                frames={frames as any}
                layout={layout}
                config={{ displayModeBar: false }}
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
