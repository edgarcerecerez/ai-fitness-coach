"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Loader2 } from "lucide-react"

type Format = "json" | "csv" | "pdf"

const FORMATS: { value: Format; label: string }[] = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDF" },
]

export function ExportPanel() {
  const [format, setFormat] = useState<Format>("json")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setError(null)
    if (start && end && start > end) {
      setError("Start date must be on or before end date.")
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ format })
      if (start) params.set("start", start)
      if (end) params.set("end", end)

      const res = await fetch(`/api/analytics/export?${params.toString()}`)
      if (!res.ok) {
        const message = await res.text().catch(() => "")
        throw new Error(message || `Export failed (${res.status})`)
      }

      const disposition = res.headers.get("content-disposition") || ""
      const match = /filename="([^"]+)"/.exec(disposition)
      const filename = match?.[1] ?? `health-export.${format}`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Export your data</CardTitle>
        <CardDescription>
          Download your weight, nutrition, and mood logs in your preferred format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="export-format">Format</Label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="export-start">Start date</Label>
            <Input
              id="export-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="export-end">End date</Label>
            <Input
              id="export-end"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button onClick={handleDownload} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Preparing…
            </>
          ) : (
            <>
              <Download className="size-4" /> Download
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
