'use client'

import { useState } from 'react'
import { NutritionLog } from '@/lib/nutrition-types'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Modal from './Modal'

interface ConfirmDeleteDialogProps {
  log: NutritionLog
  onClose: () => void
  onDeleted: (id: string) => void
}

export default function ConfirmDeleteDialog({
  log,
  onClose,
  onDeleted,
}: ConfirmDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    setDeleting(true)
    try {
      const res = await fetch(`/api/nutrition-logs/${log.id}`, {
        method: 'DELETE',
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to delete entry.')
      }
      onDeleted(log.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      title="Delete this meal?"
      description="This permanently removes the entry from your log."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </>
      }
    >
      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">
          {log.food_items?.[0]?.name
            ? `“${log.food_items[0].name}” will be permanently deleted.`
            : 'This entry will be permanently deleted.'}
        </p>
      )}
    </Modal>
  )
}
