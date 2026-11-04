import { useEffect, useState, type MouseEvent } from 'react'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { PageHead } from '../components/Shell.tsx'
import { ExtractionBeans } from '../components/ExtractionBeans.tsx'
import { BeanDosesModal, doseKey } from '../components/BeanDoses.tsx'
import { FreezerSwitch, Frost } from '../components/Frost.tsx'
import { beanFreshness, daysOffRoast, FRESHNESS_TEXT, roastedText, withFreezer } from '../data/beans.ts'
import { BeanModal } from '../components/BeanModal.tsx'
import { activeGear, BASKET_KIND } from '../data/gear.ts'
import type { Bean, BeanInput, Brew, Design, Gear, Route, Shot, Units } from '../types.ts'

const PERCENT = 100
const ICON = 14
const CENTS = 2

// ── BEANS ──────────────────────────────────────────────────────────────
interface BeansProps {
  beans:         Bean[]
  shots?:        Shot[]
  brews?:        Brew[]
  design?:       Design
  gear?:         Gear[]
  archivedCount?: number
  goTo?:         (route: Route) => void
  onDialIn?:     (bean: Bean) => void
  onOpenBean?:   (bean: Bean) => void   // the bag's own page
  units:         Units
  onSaveBean:    (bean: BeanInput) => Promise<Bean>
  onUpdateBean:  (id: string, data: BeanInput) => Promise<Bean>
  onArchiveBean: (id: string) => Promise<Bean>
  startAdding?:  boolean      // open the new-bag form right away (Home's Add a bag)
  onStartConsumed?: () => void
}

export function Beans({ beans, shots = [], brews = [], design, gear = [], archivedCount = 0, goTo, onDialIn, onOpenBean, units, onSaveBean, onUpdateBean, onArchiveBean, startAdding = false, onStartConsumed }: BeansProps) {
  const U = useUnits(units)
  const basketOpts = activeGear(gear, BASKET_KIND).map(g => g.name)
  const [adding, setAdding]   = useState(startAdding)
  const [editing, setEditing] = useState<Bean | null>(null)  // bean being edited
  const [dosesFor, setDosesFor] = useState<Bean | null>(null) // bean whose basket doses are open

  useEffect(() => { onStartConsumed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => setAdding(true)
  const openEdit = (b: Bean) => setEditing(b)
  const closeModal = () => { setAdding(false); setEditing(null) }

  // Into the freezer today, or out of it (the days it spent there are kept)
  const toggleFreezer = (b: Bean, frozen: boolean) => onUpdateBean(b.id, withFreezer(b, frozen))

  // A click anywhere on a card opens the bag's page, except on its own buttons and switch
  const openFromCard = (e: MouseEvent, b: Bean) => {
    if ((e.target as HTMLElement).closest('button, a, input, label, select')) return
    onOpenBean?.(b)
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Move this bag to Finished bags?')) return
    await onArchiveBean(id)
  }

  const showModal = adding || !!editing
  const totalLeft = beans.reduce((a, b) => a + (b.remaining || 0), 0)
  const ages = beans.map(b => daysOffRoast(b)).filter((d): d is number => d != null)
  // Whole numbers in the chosen unit; the total rounds up, so a few grams never read as nothing
  const whole = (g: number) => Math.round(parseFloat(U.m(g)))
  const sub = `${Math.ceil(parseFloat(U.m(totalLeft)))} ${U.mU()} available${ages.length ? `, roasted ${Math.min(...ages)} to ${Math.max(...ages)} days ago` : ''}`

  const extraction = design === 'extraction'

  return (
    <div className="stack">
      <PageHead title={extraction ? 'Beans' : 'Beans.'} sub={sub}>
        <div className="seg">
          <button className="on">Open {beans.length}</button>
          <button onClick={() => goTo?.('archived-beans')}>Finished {archivedCount}</button>
        </div>
        <button className="primary-btn" onClick={openAdd}><Ico name="plus" size={ICON} /> Add bean</button>
      </PageHead>

      {extraction && (
        <ExtractionBeans beans={beans} shots={shots} brews={brews} U={U} onAdd={openAdd}
          onEdit={openEdit} onDoses={setDosesFor} onArchive={handleArchive} onFreeze={toggleFreezer} onDialIn={onDialIn} onOpen={onOpenBean} />
      )}

      {!extraction && beans.length === 0 && <div className="card empty">No open bags. Add the one you're drinking now.</div>}

      {!extraction && <div className="bean-grid">
        {beans.map(b => {
          const pct = b.weight > 0 ? Math.min(PERCENT, (b.remaining / b.weight) * PERCENT) : 0
          const days = daysOffRoast(b)
          const fresh = beanFreshness(b)
          const tags = [b.process, b.roast, b.variety, b.roast_date && roastedText(b.roast_date)].filter(Boolean)
          return (
            <div key={b.id} className={`card bean-card${onOpenBean ? ' opens' : ''}${b.frozen_at ? ' frozen' : ''}`} onClick={e => openFromCard(e, b)}
              title={onOpenBean ? `Open ${b.name}` : undefined}>
              <Frost bean={b} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">{b.name}</div>
                <div className="rs">{[b.roaster, b.origin?.replace(' · ', ', ')].filter(Boolean).join(', ')}</div>
                {tags.length > 0 && <div className="tags">{tags.map(t => <span key={t} className="badge">{t}</span>)}</div>}
                {b.notes?.length > 0 && <div className="notes">{b.notes.join(', ')}</div>}
                <div className="dose-list">
                  {(b.doses || []).map(d => (
                    <div key={doseKey(d)} className="dose-row">
                      <span>{d.basket}</span>
                      <span><b>{U.m(d.dose)} {U.mU()}</b></span>
                      <span className="g">{d.grind ? <>grind <b>{d.grind}</b></> : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bean-side">
                <div className="big">{whole(b.remaining)}<small>{U.mU()} of {whole(b.weight)}</small></div>
                <div className="stock-bar"><i className={b.stock} style={{ width: `${pct}%` }} /></div>
                <div className="bean-facts">
                  {days != null && (
                    <div className="kv">
                      <span className="k">Off roast</span>
                      <span className="v">{days}<small>{days === 1 ? 'day' : 'days'}</small></span>
                      {fresh && <span className={`fresh ${fresh}`}>{FRESHNESS_TEXT[fresh]}</span>}
                    </div>
                  )}
                  {b.price > 0 && (
                    <div className="kv">
                      <span className="k">Price</span>
                      <span className="v">€{b.price % 1 === 0 ? b.price : b.price.toFixed(CENTS)}</span>
                    </div>
                  )}
                </div>
                <FreezerSwitch bean={b} onChange={on => toggleFreezer(b, on)} />
              </div>
              <div className="bean-foot">
                <button className="link-btn" onClick={() => setDosesFor(b)}>{b.doses?.length ? 'Edit basket doses' : '+ Add basket dose'}</button>
                <div className="acts">
                  {onDialIn && <button className="primary-btn" onClick={() => onDialIn(b)}>Dial in</button>}
                  <button className="ghost-btn lg" onClick={() => openEdit(b)}>Edit</button>
                  <button className="icon-btn lg" title="Move to Finished bags" aria-label="Move to Finished bags" onClick={() => handleArchive(b.id)}><Ico name="archive" size={ICON} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>}

      {showModal && (
        <BeanModal bean={editing} onSaveBean={onSaveBean} onUpdateBean={onUpdateBean} onClose={closeModal} />
      )}

      {dosesFor && (
        <BeanDosesModal
          bean={dosesFor}
          basketOpts={basketOpts}
          onSave={doses => onUpdateBean(dosesFor.id, { ...dosesFor, doses })}
          onClose={() => setDosesFor(null)}
        />
      )}
    </div>
  )
}
