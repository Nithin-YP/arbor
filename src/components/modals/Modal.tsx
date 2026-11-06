import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store'
import { cx } from '../../lib/util'

export function Modal(props: { title: ReactNode; subtitle?: ReactNode; wide?: boolean; children: ReactNode; footer?: ReactNode }) {
  const close = () => useStore.getState().setModal(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={cx('modal', props.wide && 'wide')} role="dialog" aria-modal>
        <header className="modal-head">
          <div>
            <h3>{props.title}</h3>
            {props.subtitle && <p>{props.subtitle}</p>}
          </div>
          <button className="icon-btn big" onClick={close} title="Close (Esc)">
            <X size={17} />
          </button>
        </header>
        <div className="modal-body">{props.children}</div>
        {props.footer && <footer className="modal-foot">{props.footer}</footer>}
      </div>
    </div>
  )
}
