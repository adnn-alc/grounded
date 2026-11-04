import { frozenSinceText } from '../data/beans.ts'
import type { Bean } from '../types.ts'

// A bag in the freezer: a frosted layer over its card or shelf bag, and the switch that puts it in or takes it out.

/** The frosted layer; the element it sits in gets the `frozen` class (position: relative) */
export function Frost({ bean }: { bean: Bean }) {
  if (!bean.frozen_at) return null
  return <span className="frost" aria-hidden="true" />
}

interface FreezerSwitchProps {
  bean:     Bean
  onChange: (frozen: boolean) => void
}

/** 'In the freezer' with an on/off switch, and since when while it's on */
export function FreezerSwitch({ bean, onChange }: FreezerSwitchProps) {
  const on = !!bean.frozen_at
  return (
    <div className="freezer">
      <label className={`bad-check freeze-check${on ? ' on' : ''}`}>
        In the freezer
        <input type="checkbox" role="switch" checked={on} onChange={e => onChange(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
      </label>
      {on && <small>{frozenSinceText(bean)}</small>}
    </div>
  )
}
