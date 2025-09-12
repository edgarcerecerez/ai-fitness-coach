"use client"

import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from "react"
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast"
import { setGlobalToast } from "@/hooks/use-toast"

interface ToastData {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly variant?: 'default' | 'destructive'
  readonly duration?: number
}

interface ToastState {
  readonly toasts: readonly ToastData[]
}

type ToastAction = 
  | { type: 'ADD_TOAST'; toast: ToastData }
  | { type: 'REMOVE_TOAST'; id: string }

const ToastContext = createContext<{
  toasts: ToastData[]
  addToast: (toast: Omit<ToastData, 'id'>) => void
  removeToast: (id: string) => void
} | null>(null)

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.toast]
      }
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.id)
      }
    default: {
      return assertUnreachable(action)
    }
  }
}

function assertUnreachable(x: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(x)}`)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] })

  const scheduleToastRemoval = useCallback((toastId: string, duration: number) => {
    return setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', id: toastId })
    }, duration)
  }, [])

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = crypto && 'randomUUID' in crypto ? (crypto.randomUUID as () => string)() : Math.random().toString(36).slice(2)
    const duration = toast.duration ?? 5000 // Default 5 seconds
    
    dispatch({
      type: 'ADD_TOAST',
      toast: { ...toast, id }
    })

    // Auto-remove toast after duration
    if (duration > 0) {
      scheduleToastRemoval(id, duration)
    }
  }, [scheduleToastRemoval])

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id })
  }, [])

  // Register the global toast function when provider mounts
  useEffect(() => {
    setGlobalToast(addToast)
    
    // Cleanup on unmount
    return () => {
      setGlobalToast(null)
    }
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts: [...state.toasts], addToast, removeToast }}>
      {children}
      <ToastContainer toasts={state.toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  readonly toasts: readonly ToastData[]
  readonly onRemove: (id: string) => void 
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onClose={() => onRemove(toast.id)}
          className="mb-4 last:mb-0"
        >
          <ToastTitle>{toast.title}</ToastTitle>
          {toast.description && (
            <ToastDescription>{toast.description}</ToastDescription>
          )}
        </Toast>
      ))}
    </div>
  )
}

export function useToastContext() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider')
  }
  return context
} 