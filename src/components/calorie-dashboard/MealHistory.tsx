'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Eye, Pencil, Trash2, Utensils } from 'lucide-react'
import { NutritionLog } from '@/lib/nutrition-types'
import { groupLogsByDay } from '@/lib/calorie-aggregations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import MealDetailsDialog from './MealDetailsDialog'
import MealEditDialog from './MealEditDialog'
import ConfirmDeleteDialog from './ConfirmDeleteDialog'
import {
  formatDayHeading,
  formatTime,
  logDisplayName,
  macro,
} from './format-helpers'

interface MealHistoryProps {
  logs: NutritionLog[]
  onLogChanged: (log: NutritionLog) => void
  onLogDeleted: (id: string) => void
}

export default function MealHistory({
  logs,
  onLogChanged,
  onLogDeleted,
}: MealHistoryProps) {
  const [viewing, setViewing] = useState<NutritionLog | null>(null)
  const [editing, setEditing] = useState<NutritionLog | null>(null)
  const [deleting, setDeleting] = useState<NutritionLog | null>(null)

  const grouped = useMemo(() => groupLogsByDay(logs), [logs])

  if (grouped.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meal History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No meals logged yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meal History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from(grouped.entries()).map(([dayKey, dayLogs]) => (
            <section key={dayKey} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {formatDayHeading(dayKey)}
              </h3>
              <ul className="divide-y rounded-lg border">
                {dayLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {log.image_url ? (
                        <Image
                          src={log.image_url}
                          alt={logDisplayName(log)}
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Utensils className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">
                          {logDisplayName(log)}
                        </p>
                        <Badge variant="secondary" className="shrink-0">
                          {Math.round(macro(log.total_calories))} kcal
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        P {macro(log.total_protein_g).toFixed(0)}g · C{' '}
                        {macro(log.total_carbs_g).toFixed(0)}g · F{' '}
                        {macro(log.total_fat_g).toFixed(0)}g
                        {log.logged_at ? ` · ${formatTime(log.logged_at)}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="View meal"
                        onClick={() => setViewing(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit meal"
                        onClick={() => setEditing(log)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete meal"
                        onClick={() => setDeleting(log)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>

      {viewing ? (
        <MealDetailsDialog
          log={viewing}
          onClose={() => setViewing(null)}
          onEdit={(log) => {
            setViewing(null)
            setEditing(log)
          }}
        />
      ) : null}

      {editing ? (
        <MealEditDialog
          log={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEditing(null)
            onLogChanged(updated)
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDeleteDialog
          log={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setDeleting(null)
            onLogDeleted(id)
          }}
        />
      ) : null}
    </>
  )
}
