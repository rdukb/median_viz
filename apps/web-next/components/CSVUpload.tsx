'use client'
import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Props = {
  onData: (rows: any[]) => void
  accept?: string
  sampleHint?: string
}

export default function CSVUpload({ onData, accept = '.csv,text/csv', sampleHint = "CSV columns: (year, abbr, value) or (year, state, abbr, median_income)" }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>('No file chosen')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (res) => {
        const rows = (res.data as any[]).filter(Boolean)
        onData(rows)
        if (ref.current) ref.current.value = ''
      },
      error: () => {
        if (ref.current) ref.current.value = ''
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={ref}
        id="csv-hidden-input"
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <Label htmlFor="csv-hidden-input" className="sr-only">Upload CSV</Label>
        <Button type="button" variant="outline" onClick={() => ref.current?.click()}>
          Choose File
        </Button>
        <span className="text-sm text-gray-500">{fileName}</span>
        {sampleHint ? <span className="text-sm text-gray-500"> — {sampleHint}</span> : null}
      </div>
    </div>
  )
}
