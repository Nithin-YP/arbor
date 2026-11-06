import { useRef, useState, type CSSProperties } from 'react'
import { Cpu, Download, Square } from 'lucide-react'
import { useStore } from '../../store'
import { pullModel } from '../../lib/ollama'
import { fmtBytes, modelColor, shortModel } from '../../lib/util'
import { Modal } from './Modal'

// Small models that run on a laptop CPU; sizes are approximate download sizes.
const SUGGESTED = [
  { name: 'qwen3:0.6b', note: '≈0.5 GB · tiny, fast, reasons' },
  { name: 'llama3.2:1b', note: '≈1.3 GB · solid chat' },
  { name: 'gemma3:1b', note: '≈0.8 GB · Google, concise' },
  { name: 'qwen3:4b', note: '≈2.6 GB · much smarter, slower' },
]

export function ModelsModal() {
  const models = useStore((s) => s.models)
  const ollama = useStore((s) => s.ollama)
  const base = useStore((s) => s.settings.ollamaUrl)
  const [name, setName] = useState('')
  const [progress, setProgress] = useState<{ model: string; status: string; pct?: number } | null>(null)
  const ctrl = useRef<AbortController | null>(null)

  const pull = async (model: string) => {
    model = model.trim()
    if (!model || progress) return
    const ac = new AbortController()
    ctrl.current = ac
    setProgress({ model, status: 'starting…' })
    try {
      await pullModel(
        base,
        model,
        (p) => setProgress({ model, status: p.status, pct: p.total ? (100 * (p.completed ?? 0)) / p.total : undefined }),
        ac.signal,
      )
      useStore.getState().showToast(`${model} is ready`)
      setName('')
      await useStore.getState().refreshModels()
    } catch (e) {
      if (!ac.signal.aborted) useStore.getState().showToast(`Pull failed: ${e instanceof Error ? e.message : e}`, 'error')
    } finally {
      setProgress(null)
      ctrl.current = null
    }
  }

  return (
    <Modal
      title={
        <>
          <Cpu size={18} /> Local models
        </>
      }
      subtitle={
        ollama === 'online'
          ? 'Everything runs on this machine through Ollama: no API keys, no cost.'
          : 'Ollama is not reachable. Start it (the Ollama app, or `ollama serve`), then reopen this.'
      }
    >
      <div className="model-list">
        {models.length === 0 && <div className="panel-empty muted-text">No models installed yet. Pull one below.</div>}
        {models.map((m) => (
          <div key={m.name} className="model-row">
            <span className="dot" style={{ '--c': modelColor(m.name) } as CSSProperties} />
            <b>{shortModel(m.name)}</b>
            <span className="muted-text">
              {[m.family, m.params].filter(Boolean).join(' · ')}
            </span>
            <span className="grow" />
            <span className="muted-text">{fmtBytes(m.size)}</span>
          </div>
        ))}
      </div>

      <div className="field">
        <span>Pull a model from the Ollama library</span>
        <div className="pull-row">
          <input
            className="input"
            value={name}
            placeholder="e.g. qwen3:0.6b"
            spellCheck={false}
            disabled={!!progress}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void pull(name)}
          />
          {progress ? (
            <button className="btn" onClick={() => ctrl.current?.abort()}>
              <Square size={12} /> Cancel
            </button>
          ) : (
            <button className="btn primary" disabled={!name.trim() || ollama !== 'online'} onClick={() => void pull(name)}>
              <Download size={14} /> Pull
            </button>
          )}
        </div>
        <div className="suggest">
          {SUGGESTED.map((s) => (
            <button
              key={s.name}
              className="chip"
              disabled={!!progress || ollama !== 'online' || models.some((m) => m.name === s.name)}
              onClick={() => void pull(s.name)}
              title={s.note}
            >
              {s.name}
              <span>{models.some((m) => m.name === s.name) ? 'installed' : s.note}</span>
            </button>
          ))}
        </div>
        {progress && (
          <div className="pull-progress">
            <div className="row">
              <b>{progress.model}</b>
              <span className="muted-text">
                {progress.status}
                {progress.pct !== undefined && ` · ${progress.pct.toFixed(0)}%`}
              </span>
            </div>
            <div className="bar big">
              <span style={{ width: `${progress.pct ?? 0}%` }} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
