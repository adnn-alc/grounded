import { useState, type CSSProperties } from 'react'
import Ico from './Ico.tsx'
import { doseKey } from './BeanDoses.tsx'
import { FreezerSwitch, Frost } from './Frost.tsx'
import { bagColor, beanFreshness, daysOffRoast, FRESHNESS_TEXT, priceText, roastedText } from '../data/beans.ts'
import { shortDay } from '../data/dates.ts'
import { mmss, ratingOrder, ratingText } from '../data/taste.ts'
import type { UnitHelpers } from '../hooks/useUnits.ts'
import type { Bean, Brew, Shot } from '../types.ts'

// Extraction's Beans: the open bags as a shelf, each filled to what's left; below it the
// picked bag (where it's from and its notes, its basket doses, what's left), then its best coffees.

const PERCENT = 100
const ICON = 14
const RATING_DECIMALS = 1
const BEST_SHOWN = 4

type Coffee = (Shot & { kind: 'shot' }) | (Brew & { kind: 'brew' })

interface ExtractionBeansProps {
  beans:     Bean[]
  shots:     Shot[]
  brews:     Brew[]
  U:         UnitHelpers
  onAdd:     () => void
  onEdit:    (bean: Bean) => void
  onDoses:   (bean: Bean) => void
  onArchive: (id: string) => void
  onFreeze:  (bean: Bean, frozen: boolean) => void
  onDialIn?: (bean: Bean) => void
  onOpen?:   (bean: Bean) => void   // the bag's own page: a second click on the picked bag
}

/** 'Light roast' from 'Light', left alone when it already says roast */
const roastText = (roast: string): string => roast.toLowerCase().includes('roast') ? roast : `${roast} roast`

/** 'today', 'yesterday', 'Saturday', '19 Apr': after a comma, so only the first two go lowercase */
function dayWord(date: string): string {
  const day = shortDay(date)
  return day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day
}

/** Which coffees the best list holds: 'Shots', 'Brews' or both */
function coffeeWord(list: Coffee[]): string {
  const hasShots = list.some(c => c.kind === 'shot')
  const hasBrews = list.some(c => c.kind === 'brew')
  if (hasShots && hasBrews) return 'Shots and brews'
  return hasBrews ? 'Brews' : 'Shots'
}

export function ExtractionBeans({ beans, shots, brews, U, onAdd, onEdit, onDoses, onArchive, onFreeze, onDialIn, onOpen }: ExtractionBeansProps) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  // After a bag is finished the first one is picked again
  const bean = beans.find(b => b.id === pickedId) ?? beans[0]
  const whole = (g: number) => Math.round(parseFloat(U.m(g)))
  const num = (g: number) => parseFloat(U.m(g))

  return (
    <div className="xbeans">
      <div className="xshelf xbeans-shelf">
        {beans.map(b => {
          const pct = b.weight > 0 ? Math.min(PERCENT, (b.remaining / b.weight) * PERCENT) : 0
          const days = daysOffRoast(b)
          const on = b.id === bean?.id
          // The first click picks the bag and shows it below; a click on the bag you picked opens its page
          const opens = Boolean(onOpen) && b.id === pickedId
          return (
            <button key={b.id} className={`xbag${b.stock !== 'good' ? ' low' : ''}${on ? ' on' : ''}${b.frozen_at ? ' frozen' : ''}`} aria-pressed={on}
              title={opens ? `Open ${b.name}` : `Show ${b.name}`}
              onClick={() => (opens ? onOpen?.(b) : setPickedId(b.id))} style={{ '--bag': bagColor(b.id) } as CSSProperties}>
              <span className="xbag-fill" style={{ height: `${pct}%` }} />
              <Frost bean={b} />
              <span className="xbag-lab">
                <b>{b.name}</b>
                <span>{b.roaster}</span>
              </span>
              <span className="xbag-g">{whole(b.remaining)} {U.mU()}</span>
              {b.frozen_at && <span className="xbag-d"><Ico name="snow" size={ICON} /> frozen</span>}
              {!b.frozen_at && days != null && <span className="xbag-d">day {days}</span>}
            </button>
          )
        })}
        <button className="xbag-add" onClick={onAdd}>Add a bag</button>
      </div>

      {!bean && <div className="xbeans-empty">No open bags. Add the one you're drinking now.</div>}
      {bean && <BagDetails bean={bean} shots={shots} brews={brews} U={U} whole={whole} num={num}
        onEdit={onEdit} onDoses={onDoses} onArchive={onArchive} onFreeze={onFreeze} onDialIn={onDialIn} onOpen={onOpen} />}
    </div>
  )
}

interface BagDetailsProps {
  bean:      Bean
  shots:     Shot[]
  brews:     Brew[]
  U:         UnitHelpers
  whole:     (g: number) => number
  num:       (g: number) => number
  onEdit:    (bean: Bean) => void
  onDoses:   (bean: Bean) => void
  onArchive: (id: string) => void
  onFreeze:  (bean: Bean, frozen: boolean) => void
  onDialIn?: (bean: Bean) => void
  onOpen?:   (bean: Bean) => void
}

function BagDetails({ bean, shots, brews, U, whole, num, onEdit, onDoses, onArchive, onFreeze, onDialIn, onOpen }: BagDetailsProps) {
  const days = daysOffRoast(bean)
  const fresh = beanFreshness(bean)
  const doses = bean.doses || []
  const from = [bean.roaster, bean.origin?.replace(' · ', ', '), bean.altitude].filter(Boolean).join(', ')
  const pills = [bean.process, bean.roast && roastText(bean.roast), bean.variety, bean.roast_date && roastedText(bean.roast_date)].filter(Boolean)
  const bagLine = [bean.weight > 0 && `${whole(bean.weight)} ${U.mU()} bag`, bean.price > 0 && priceText(bean.price, U.cur())].filter(Boolean).join(', ')

  // The bag's coffees, best rated first, newest first on a tie
  const best: Coffee[] = [
    ...shots.filter(s => s.bean_id === bean.id).map(s => ({ ...s, kind: 'shot' as const })),
    ...brews.filter(b => b.bean_id === bean.id).map(b => ({ ...b, kind: 'brew' as const })),
  ].sort((a, b) => ratingOrder(b.rating) - ratingOrder(a.rating) || b.date.localeCompare(a.date)).slice(0, BEST_SHOWN)

  return (
    <>
      <div className="xbean-det">
        <div className="xbean-about">
          <div className="xbean-name">{bean.name}</div>
          {onOpen && <button className="link-btn xbean-open" onClick={() => onOpen(bean)}>Open the bag's page <Ico name="chevronR" size={ICON} /></button>}
          {from && <div className="xbean-from">{from}</div>}
          {pills.length > 0 && <div className="xd-facts">{pills.map(p => <span key={String(p)}>{p}</span>)}</div>}
          {bean.notes?.length > 0 && <div className="xbean-notes">{bean.notes.join(', ')}</div>}
        </div>

        <div className="xbean-doses">
          <div className="xlbl"><b>Basket doses</b></div>
          {doses.length === 0 && <div className="xbean-none">None yet. Save the dose you weigh for each basket.</div>}
          {doses.map(d => (
            <div key={doseKey(d)} className="xbean-dose">
              <span>{d.basket}</span>
              <b>{U.m(d.dose)}<small> {U.mU()}</small></b>
              <em>{d.grind ? `grind ${d.grind}` : ''}</em>
            </div>
          ))}
          <button className="link-btn" onClick={() => onDoses(bean)}>{doses.length ? 'Edit basket doses' : '+ Add a basket dose'}</button>
        </div>

        <div className="xbean-left">
          <div className="xnum">{whole(bean.remaining)}<small>{U.mU()} left</small></div>
          <p>
            {days != null && fresh && <>Day {days}, {FRESHNESS_TEXT[fresh]}<br /></>}
            {bagLine}
          </p>
          <FreezerSwitch bean={bean} onChange={frozen => onFreeze(bean, frozen)} />
          <div className="xbean-acts">
            {onDialIn && <button className="primary-btn" onClick={() => onDialIn(bean)}>Dial in</button>}
            <button className="ghost-btn lg" onClick={() => onEdit(bean)}><Ico name="pencil" size={ICON} /> Edit</button>
            <button className="ghost-btn lg sq" title="Move to Finished bags" aria-label="Move to Finished bags" onClick={() => onArchive(bean.id)}>
              <Ico name="archive" size={ICON} />
            </button>
          </div>
        </div>
      </div>

      {best.length > 0 && (
        <div className="xbean-best">
          <div className="xlbl"><b>{coffeeWord(best)} with {bean.name}</b>, best first</div>
          <div className="xbean-best-list">
            {best.map(c => (
              <div key={`${c.kind}-${c.id}`}>
                <b>
                  {num(c.dose)} → {num(c.kind === 'shot' ? c.yield : c.water)}
                  <em>{c.kind === 'shot' ? c.time : mmss(c.time)}</em>
                </b>
                <span>{c.bad ? `Bad ${c.kind}` : ratingText(c.rating, RATING_DECIMALS)}, {dayWord(c.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
