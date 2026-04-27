'use client'

import Image from 'next/image'
import { Pencil } from 'lucide-react'
import { NutritionLog } from '@/lib/nutrition-types'
import { Button } from '@/components/ui/button'
import Modal from './Modal'
import { formatDateTime, macro } from './format-helpers'

interface MealDetailsDialogProps {
  log: NutritionLog
  onClose: () => void
  onEdit: (log: NutritionLog) => void
}

export default function MealDetailsDialog({
  log,
  onClose,
  onEdit,
}: MealDetailsDialogProps) {
  const macroStats: { label: string; value: string }[] = [
    { label: 'Calories', value: String(Math.round(macro(log.total_calories))) },
    { label: 'Protein', value: `${macro(log.total_protein_g).toFixed(1)}g` },
    { label: 'Carbs', value: `${macro(log.total_carbs_g).toFixed(1)}g` },
    { label: 'Fat', value: `${macro(log.total_fat_g).toFixed(1)}g` },
  ]

  return (
    <Modal
      title="Meal details"
      description={log.logged_at ? formatDateTime(log.logged_at) : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onEdit(log)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {log.image_url ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            <Image
              src={log.image_url}
              alt="Meal photo"
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          {macroStats.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-3">
              <div className="text-xs uppercase text-muted-foreground">
                {stat.label}
              </div>
              <div className="text-lg font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>

        {log.food_items?.length ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Food items</h3>
            <ul className="divide-y rounded-md border">
              {log.food_items.map((item, idx) => (
                <li
                  key={item.id ?? idx}
                  className="flex justify-between px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {item.name || `Item ${idx + 1}`}
                    {item.serving_size ? (
                      <span className="ml-1 text-muted-foreground">
                        ({item.serving_size})
                      </span>
                    ) : null}
                  </span>
                  <span className="ml-2 shrink-0 text-muted-foreground">
                    {Math.round(macro(item.calories))} kcal
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {log.notes ? (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {log.notes}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
