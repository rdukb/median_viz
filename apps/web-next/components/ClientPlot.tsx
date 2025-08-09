'use client'
import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

type Props = {
  data: any[]
  frames?: any[]
  layout?: any
  config?: any
  className?: string
  height?: number | string
}

export default function ClientPlot({
  data,
  frames,
  layout,
  config,
  className,
  height = 520,              // keep a stable height to avoid resize thrash
}: Props) {
  // Always provide a config object; merge caller’s config last
  const safeConfig = {
    responsive: true,
    displayModeBar: false,
    scrollZoom: false,
    doubleClick: 'reset',
    ...config,
  }

  // Give Plotly a stable container + its own resize handler
  return (
    <div className={className} style={{ width: '100%' }}>
      <Plot
        data={data || []}
        frames={frames || []}
        layout={{ autosize: true, ...layout }}
        config={safeConfig}
        useResizeHandler
        style={{ width: '100%', height }}
      />
    </div>
  )
}
