import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastVariant = 'success' | 'warn' | 'info'

type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
  leaving: boolean
}

type ToastOptions = {
  variant?: ToastVariant
  durationMs?: number
}

type ToastApi = {
  toast: (message: string, options?: ToastOptions) => void
  success: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DEFAULT_DURATION_MS = 3200
const EXIT_MS = 220

function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`toast toast--${item.variant}${item.leaving ? ' toast--leaving' : ''}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const clearTimer = useCallback((key: string) => {
    const timer = timersRef.current.get(key)
    if (timer != null) {
      window.clearTimeout(timer)
      timersRef.current.delete(key)
    }
  }, [])

  const removeToast = useCallback(
    (id: string) => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      clearTimer(id)
      clearTimer(`exit-${id}`)
    },
    [clearTimer],
  )

  const dismiss = useCallback(
    (id: string) => {
      setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)))
      clearTimer(id)
      const exitTimer = window.setTimeout(() => removeToast(id), EXIT_MS)
      timersRef.current.set(`exit-${id}`, exitTimer)
    },
    [clearTimer, removeToast],
  )

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const trimmed = message.trim()
      if (!trimmed) return
      const id = crypto.randomUUID()
      const variant = options?.variant ?? 'success'
      const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS
      setToasts((prev) => [...prev, { id, message: trimmed, variant, leaving: false }])
      const timer = window.setTimeout(() => dismiss(id), durationMs)
      timersRef.current.set(id, timer)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (message: string) => toast(message, { variant: 'success' }),
    }),
    [toast],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
