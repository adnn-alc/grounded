import { useEffect, type ReactNode } from 'react'

/** The dimmed layer behind a popup: clicking it or pressing Escape closes the popup */
export function Backdrop({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="modal-backdrop" onClick={onClose}>{children}</div>
}

export function Meta({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ padding: '5px 0' }}>
      <div className="micro">{k}</div>
      <div className="mono" style={{ fontSize: 12, marginTop: 2 }}>{v}</div>
    </div>
  )
}
