'use client'

import { useState } from 'react'
import { NutritionLog } from '@/lib/nutrition-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Modal from './Modal'
import { macro } from './format-helpers'

interface MealEditDialogProps {
  log: NutritionLog
  onClose: () => void
  onSaved: (updated: NutritionLog) => void
}

interface FormState {
  name: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  notes: string
}

type MacroField = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'

const MACRO_FIELDS: { key: MacroField; label: string; step: string }[] = [
  { key: 'calories', label: 'Calories', step: '1' },
  { key: 'protein_g', label: 'Protein (g)', step: '0.1' },
  { key: 'carbs_g', label: 'Carbs (g)', step: '0.1' },
  { key: 'fat_g', label: 'Fat (g)', step: '0.1' },
]

function initialForm(log: NutritionLog): FormState {
  return {
    name: log.food_items?.[0]?.name ?? '',
    calories: String(Math.round(macro(log.total_calories))),
    protein_g: String(macro(log.total_protein_g)),
    carbs_g: String(macro(log.total_carbs_g)),
    fat_g: String(macro(log.total_fat_g)),
    notes: log.notes ?? '',
  }
}

function parseNonNegativeNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

export default function MealEditDialog({
  log,
  onClose,
  onSaved,
}: MealEditDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(log))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setError(null)

    const parsed: Record<MacroField, number | null> = {
      calories: parseNonNegativeNumber(form.calories),
      protein_g: parseNonNegativeNumber(form.protein_g),
      carbs_g: parseNonNegativeNumber(form.carbs_g),
      fat_g: parseNonNegativeNumber(form.fat_g),
    }

    if (Object.values(parsed).some((v) => v === null)) {
      setError('All macro fields must be non-negative numbers.')
      return
    }
    const { calories, protein_g, carbs_g, fat_g } = parsed as Record<
      MacroField,
      number
    >

    // Keep the meal title in sync by updating the first food item's name. If
    // the log has no food items, create a placeholder so the schema's NOT NULL
    // food_items column stays valid.
    const trimmedName = form.name.trim()
    const updatedItems = log.food_items?.length
      ? log.food_items.map((item, idx) =>
          idx === 0 ? { ...item, name: trimmedName || item.name } : item
        )
      : [
          {
            id: '1',
            name: trimmedName || 'Meal',
            calories,
            protein_g,
            carbs_g,
            fat_g,
            fiber_g: macro(log.total_fiber_g),
          },
        ]

    setSaving(true)
    try {
      const res = await fetch(`/api/nutrition-logs/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_items: updatedItems,
          total_calories: calories,
          total_protein_g: protein_g,
          total_carbs_g: carbs_g,
          total_fat_g: fat_g,
          notes: form.notes.trim() || null,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to save changes.')
      }

      // Preserve the existing signed image_url since the API response only
      // contains the stored image_url (which may be expired).
      onSaved({ ...payload.data, image_url: log.image_url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit meal"
      description="Update the macros, name, or notes for this entry."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="meal-name">Name</Label>
          <Input
            id="meal-name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Grilled chicken bowl"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MACRO_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`meal-${field.key}`}>{field.label}</Label>
              <Input
                id={`meal-${field.key}`}
                type="number"
                inputMode="decimal"
                min="0"
                step={field.step}
                value={form[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="meal-notes">Notes</Label>
          <Textarea
            id="meal-notes"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </div>
    </Modal>
  )
}
