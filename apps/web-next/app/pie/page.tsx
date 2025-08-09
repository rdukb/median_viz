'use client'
import { useMemo, useState } from 'react'
import ClientPlot from '@/components/ClientPlot'
import Papa from 'papaparse'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CSVUpload from '@/components/CSVUpload'

type Row = { year: string | number; category: string; amount: number }

const defaultCsv = `year,category,amount
2022,Payroll Taxes,1400
2022,Individual Income Taxes,2300
2022,Corporate Taxes,500
2022,Other Taxes,280
2023,Payroll Taxes,1450
2023,Individual Income Taxes,2400
2023,Corporate Taxes,520
2023,Other Taxes,300
2024,Payroll Taxes,1500
2024,Individual Income Taxes,2500
2024,Corporate Taxes,550
2024,Other Taxes,310
`

const pastel = ['#a5b4fc','#86efac','#fde68a','#f9a8d4','#c4b5fd','#93c5fd','#fda4af']

export default function PiePage() {
  const [rows, setRows] = useState<Row[]>(() => {
    const parsed = Papa.parse<Row>(defaultCsv, { header: true, dynamicTyping: true })
    return (parsed.data || []).filter(
      (r) => r && r.category && r.amount != null && r.year != null
    )
  })

  const years = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r.year)))).sort(),
    [rows]
  )
  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort(),
    [rows]
  )
  const colorMap = useMemo(
    () => Object.fromEntries(categories.map((c, i) => [c, pastel[i % pastel.length]])),
    [categories]
  )

  const frames = years.map((y) => {
    const perYear = categories.map(
      (c) => rows.find((r) => String(r.year) === y && r.category === c)?.amount ?? 0
    )
    return {
      name: y,
      data: [
        {
          type: 'pie' as const,
          labels: categories,
          values: perYear,
          hole: 0.3,
          sort: false,
          marker: { colors: categories.map((c) => colorMap[c]) },
          textinfo: 'label+percent',
          hovertemplate: '%{label}<br>%{value:,} B<extra></extra>',
        },
      ],
    }
  })

  const layout: any = {
    title: 'Federal Revenue by Tax Type — Animated',
    template: 'plotly_white',
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { color: '#222', size: 14 },
    margin: { l: 10, r: 10, t: 60, b: 10 },
    updatemenus: [
      {
        type: 'buttons',
        showactive: false,
        x: 0.02,
        y: 1.15,
        xanchor: 'left',
        yanchor: 'top',
        buttons: [
          {
            label: '▶ Play',
            method: 'animate',
            args: [
              null,
              {
                frame: { duration: 800, redraw: true },
                transition: { duration: 400 },
                fromcurrent: true,
              },
            ],
          },
          {
            label: '⏸ Pause',
            method: 'animate',
            args: [
              [null],
              {
                mode: 'immediate',
                frame: { duration: 0, redraw: false },
                transition: { duration: 0 },
              },
            ],
          },
        ],
      },
    ],
    sliders: [
      {
        active: 0,
        x: 0.1,
        y: 0.02,
        len: 0.8,
        currentvalue: { prefix: 'Year: ', font: { size: 16, color: '#222' } },
        steps: years.map((y) => ({
          label: y,
          method: 'animate',
          args: [[y], { mode: 'immediate', frame: { duration: 0, redraw: true }, transition: { duration: 0 } }],
        })),
      },
    ],
  }

  const onUpload = (arr: any[]) => {
    const cleaned = arr
      .map((r) => ({
        year: r.year,
        category: r.category,
        amount: Number(r.amount),
      }))
      .filter((r) => r.category && r.amount != null && r.year != null && !Number.isNaN(r.amount))
    setRows(cleaned as Row[])
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Animated Revenue Donut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <CSVUpload onData={onUpload} sampleHint="CSV columns: year, category, amount" />
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
