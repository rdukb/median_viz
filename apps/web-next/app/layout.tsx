import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Median Viz — Pastel UI',
  description: 'Animated charts with Next.js + Tailwind + Plotly',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
