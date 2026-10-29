// Small error toasts for failed saves. useData calls showError(); <Toaster /> in
// App.tsx renders them in the corner until they time out or are closed.
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import Ico from './Ico.tsx'

interface ToastMessage { id: number, text: string }

const TOAST_MS = 7000
const MAX_TOASTS = 3

const listeners = new Set<(t: ToastMessage) => void>()
let nextId = 1

export function showError(text: string): void {
  const toast = { id: nextId++, text }
  listeners.forEach(l => l(toast))
}

/** Marks an error as already shown, so the page's own unhandled rejection doesn't log it again */
export function markShown(e: unknown): unknown {
  if (e && typeof e === 'object') Object.assign(e, { toastShown: true })
  return e
}

export function Toaster(): ReactElement {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const onToast = (t: ToastMessage): void => {
      setToasts(prev => [...prev, t].slice(-MAX_TOASTS))
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), TOAST_MS)
    }
    // Save buttons await the mutation and let a failure bubble up; it has been shown, so keep the console quiet
    const onRejection = (e: PromiseRejectionEvent): void => {
      if ((e.reason as { toastShown?: boolean } | null)?.toastShown) e.preventDefault()
    }
    listeners.add(onToast)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      listeners.delete(onToast)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="toast toast-error">
          <span>{t.text}</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
            <Ico name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
