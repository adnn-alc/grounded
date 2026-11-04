// Quick log: a shot in a few taps, made for the phone at the machine. The recipe and gear
// start from the last shot with the bag; dose, out and time are nudged with − / +, and
// where it landed is optional. It's saved untasted (no rating), and taste can be added
// later from History. Both designs use it; their styles differ only in the type.
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import Ico from '../components/Ico.tsx'
import { LandedSlider } from '../components/Landed.tsx'
import { stepValue } from '../components/Fields.tsx'
import { BagPicker, PageHead } from '../components/Shell.tsx'
import { useUnits, wholeMass } from '../hooks/useUnits.ts'
import { useShotForm, type CarriedShot } from '../hooks/useDialinForm.ts'
import { bagColor, daysOffRoast } from '../data/beans.ts'
import { ratioText } from '../data/taste.ts'
import type { Shot } from '../types.ts'
import type { EspressoDialinProps } from './Dialin.tsx'

const DOSE_STEP  = 0.1
const OUT_STEP   = 0.5
const TIME_STEP  = 1
const MAX_SECONDS = 600
const ICON = 15

interface QuickShotProps extends Omit<EspressoDialinProps, 'onUpdateBean' | 'footer'> {
  /** Open the full form with what's entered so far */
  onFull: (shot: Shot, carried: CarriedShot) => void
}

interface StepperProps {
  label:    string
  value:    string
  onChange: (value: string) => void
  step:     number
  unit:     string
  max?:     number
  accent?:  boolean
}

/** One number to nudge: − and + either side of it, and it can be typed in too */
function Stepper({ label, value, onChange, step, unit, max, accent = false }: StepperProps) {
  const nudge = (dir: 1 | -1) => onChange(stepValue(value, dir, step, 0, max))
  return (
    <div className={`qstep${accent ? ' accent' : ''}`}>
      <span className="l">{label}</span>
      <button type="button" className="pm" aria-label={`Less ${label.toLowerCase()}`} onClick={() => nudge(-1)}>−</button>
      <label className="v">
        <input inputMode="decimal" value={value} aria-label={label} onChange={e => onChange(e.target.value)} />
        <span>{unit}</span>
      </label>
      <button type="button" className="pm" aria-label={`More ${label.toLowerCase()}`} onClick={() => nudge(1)}>+</button>
    </div>
  )
}

export function QuickShot({ units, brewModes, modeSwitch, onBack, onFull, ...args }: QuickShotProps) {
  const U = useUnits(units)
  const { beans, shots } = args
  const f = useShotForm({ ...args, brewModes })
  const { bean, lastShot } = f
  const days = bean ? daysOffRoast(bean) : null

  // Start from the last shot with this bag (or the last shot at all): recipe, grind, gear and its time
  const from = lastShot ?? shots[0]
  useEffect(() => {
    if (!from) return
    f.loadShot(from)
    f.setShotTime(String(from.time))
  }, [f.selectedBean]) // eslint-disable-line react-hooks/exhaustive-deps

  const gear = [f.machine, f.grinderModel && `${f.grinderModel} at ${f.grind}`, f.basket, f.temp && `${U.t(parseFloat(f.temp))} ${U.tU()}`].filter(Boolean).join(', ')
  // What the full form gets when switching over: everything entered here
  const toFull = () => onFull(
    { ...from, dose: f.doseNum, yield: f.yieldNum, grind: parseFloat(f.grind) || 0, temp: parseFloat(f.temp) || 0,
      machine: f.machine, grinder_model: f.grinderModel, basket: f.basket || null, bean_id: f.selectedBean || null, bean: bean?.name ?? '' } as Shot,
    { time: f.shotTime, landed: f.landed, bad: f.bad },
  )
  const lastLine: ReactNode = lastShot && <>last time {U.m(lastShot.dose)} → {U.m(lastShot.yield)} in {lastShot.time} s</>

  return (
    <>
      <PageHead title="Pull a shot." onBack={onBack}>{modeSwitch}</PageHead>
      <div className="quick">
        {bean ? (
          <div className="qbag" style={{ '--bag': bagColor(bean.id) } as CSSProperties}>
            <i />
            <div><b>{bean.name}</b><span>{[days != null && `day ${days}`, `${wholeMass(U, bean.remaining)} ${U.mU()} left`].filter(Boolean).join(', ')}</span></div>
            {beans.length > 1 && <BagPicker beans={beans} bean={bean} onPick={f.setSelectedBean} className="link-btn" />}
          </div>
        ) : <div className="qbag empty">No open bags. The shot is saved without one.</div>}

        <Stepper label="Dose" value={f.dose} onChange={f.setDose} step={DOSE_STEP} unit={U.mU()} />
        <Stepper label="Out" value={f.yieldG} onChange={f.setYieldG} step={OUT_STEP} unit={U.mU()} />
        <Stepper label="Time" value={f.shotTime} onChange={f.setShotTime} step={TIME_STEP} unit="s" max={MAX_SECONDS} accent />
        <div className="qratio"><span>Ratio <b>{ratioText(f.doseNum, f.yieldNum)}</b></span>{lastLine && <span>{lastLine}</span>}</div>

        <div className="qland">
          <LandedSlider landed={f.landed} bad={f.bad} onChange={f.setLanded} onBadChange={f.setBad} title="How did it land?" />
        </div>

        {gear && <div className="qgear">{from ? 'Same as last time' : 'Your usual gear'}: <b>{gear}</b>.</div>}

        <div className="qsave">
          <button className="primary-btn" onClick={f.saveQuickShot} disabled={!f.canSave} title={f.canSave ? '' : 'Enter the shot time first'}>
            <Ico name="check" size={ICON} /> Save shot
          </button>
          <button className="link-btn" onClick={toFull}>Taste and notes in Full</button>
        </div>
      </div>
    </>
  )
}
