import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, ChevronDown, Cpu } from 'lucide-react'
import { useStore } from '../store'
import { cx, fmtBytes, modelColor, shortModel } from '../lib/util'

/** Multi-select: choosing several models fans one prompt out into sibling branches. */
export function ModelPicker() {
  const models = useStore((s) => s.models)
  const chosen = useStore((s) => s.settings.composerModels)
  const setSettings = useStore((s) => s.setSettings)
  const setModal = useStore((s) => s.setModal)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const live = chosen.filter((m) => models.some((x) => x.name === m))
  const toggle = (name: string) =>
    setSettings({ composerModels: chosen.includes(name) ? chosen.filter((m) => m !== name) : [...chosen, name] })

  return (
    <div className="picker" ref={ref}>
      <button className={cx('btn ghost picker-btn', !live.length && 'warn')} onClick={() => setOpen((o) => !o)}>
        <span className="dots">
          {live.slice(0, 3).map((m) => (
            <span key={m} className="dot" style={{ background: modelColor(m) }} />
          ))}
          {!live.length && <Cpu size={14} />}
        </span>
        {live.length === 0
          ? 'Choose model'
          : live.length === 1
            ? shortModel(live[0])
            : `${shortModel(live[0])} +${live.length - 1}`}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="popover picker-pop">
          <div className="pop-head">
            Models
            <span>Pick several to fan out: one branch per model</span>
          </div>
          <div className="pop-list">
            {models.length === 0 && <div className="pop-empty">No local models installed yet.</div>}
            {models.map((m) => {
              const on = chosen.includes(m.name)
              return (
                <button key={m.name} className={cx('pop-item', on && 'on')} onClick={() => toggle(m.name)}>
                  <span className="check">{on && <Check size={12} />}</span>
                  <span className="dot" style={{ '--c': modelColor(m.name) } as CSSProperties} />
                  <span className="pop-name">{shortModel(m.name)}</span>
                  <span className="pop-meta">
                    {m.params ?? ''} · {fmtBytes(m.size)}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            className="pop-foot"
            onClick={() => {
              setOpen(false)
              setModal('models')
            }}
          >
            Manage / pull models…
          </button>
        </div>
      )}
    </div>
  )
}
