// Shown on Home only on a new install that still has its sample data. It goes away
// for good once the samples are removed or the user chooses to keep them.
import { useState } from 'react'
import type { ReactElement } from 'react'
import Ico from './Ico.tsx'

interface SampleDataBannerProps {
  onRemove: () => Promise<void>
  onKeep:   () => void
}

const CONFIRM_TEXT = [
  'Remove the sample data?',
  '',
  'This deletes the sample beans, shots, brews and gear that Grounded came with.',
  "Anything you added yourself stays, and so do the recipes. This can't be undone.",
].join('\n')

export function SampleDataBanner({ onRemove, onKeep }: SampleDataBannerProps): ReactElement {
  const [busy, setBusy] = useState(false)

  const remove = async (): Promise<void> => {
    if (!confirm(CONFIRM_TEXT)) return
    setBusy(true)
    try {
      await onRemove()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card sample-banner">
      <Ico name="cup" size={16} />
      <div className="sample-banner-text">
        <strong>Welcome to Grounded.</strong> It comes with a few sample beans, shots and gear so you can look around.
        When you're ready to log your own, remove them here. Anything you add yourself is never touched.
      </div>
      <div className="row sample-banner-actions">
        <button className="ghost-btn" onClick={onKeep} disabled={busy}>Keep them</button>
        <button className="ghost-btn danger" onClick={remove} disabled={busy}>
          {busy ? 'Removing…' : 'Remove sample data'}
        </button>
      </div>
    </div>
  )
}
