import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { ArrowUp, CornerDownRight, Download, Layers, MessagesSquare, Sparkles, Square, X } from 'lucide-react'
import { useStore } from '../store'
import { branchLabel, estimateTokens, previewFor } from '../lib/context'
import { cx, fmtTokens, snippet } from '../lib/util'
import { ModelPicker } from './ModelPicker'

const st = useStore.getState

function ContextChips() {
  const selection = useStore((s) => s.selection)
  const nodes = useStore((s) => s.graph.nodes)
  const label = (id: string) => {
    const n = nodes[id]
    return snippet(n?.prompt || n?.response || (n?.kind === 'summary' ? 'checkpoint' : 'node'), 34)
  }
  if (!selection.length)
    return (
      <span className="ctx-chip root">
        <Sparkles size={13} /> New conversation
      </span>
    )
  if (selection.length === 1)
    return (
      <button className="ctx-chip" onClick={() => st().focus(selection[0])} title="Show on canvas">
        <CornerDownRight size={13} /> Continue from “{label(selection[0])}”
      </button>
    )
  return (
    <span className="ctx-merge">
      Merge
      {selection.map((id, i) => (
        <button key={id} className="ctx-chip merge" onClick={() => st().focus(id)}>
          <b>{branchLabel(i)}</b> {label(id)}
        </button>
      ))}
    </span>
  )
}

export function Composer() {
  const draft = useStore((s) => s.draft)
  const selection = useStore((s) => s.selection)
  const graph = useStore((s) => s.graph)
  const numCtx = useStore((s) => s.settings.numCtx)
  const chosen = useStore((s) => s.settings.composerModels)
  const models = useStore((s) => s.models)
  const ollama = useStore((s) => s.ollama)
  const ollamaUrl = useStore((s) => s.settings.ollamaUrl)
  const dialogue = useStore((s) => s.dialogue)
  const composerFocus = useStore((s) => s.composerFocus)
  const anyBusy = useStore((s) => Object.values(s.graph.nodes).some((n) => n.status === 'streaming'))
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (composerFocus) ref.current?.focus()
  }, [composerFocus])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [draft])

  const tokens = useMemo(() => estimateTokens(previewFor(graph, selection, draft)), [graph, selection, draft])
  const live = chosen.filter((m) => models.some((x) => x.name === m))
  const canSend = !!draft.trim() && live.length > 0
  const pct = Math.min(100, (tokens / numCtx) * 100)

  const placeholder =
    selection.length === 0
      ? 'Start a new conversation…'
      : selection.length === 1
        ? 'Continue this branch…'
        : `Ask about branches ${selection.map((_, i) => branchLabel(i)).join(' + ')} together…`

  return (
    <div className="composer-dock">
      {ollama === 'offline' && (
        <div className="banner error">
          Can't reach Ollama at <code>{ollamaUrl}</code>. Is it running?
          <button className="btn small" onClick={() => void st().refreshModels()}>
            Retry
          </button>
        </div>
      )}
      {ollama === 'online' && models.length === 0 && (
        <div className="banner">
          Ollama is running but has no models yet.
          <button className="btn small primary" onClick={() => st().setModal('models')}>
            <Download size={13} /> Pull a model
          </button>
        </div>
      )}
      {dialogue && (
        <div className="banner talk">
          <MessagesSquare size={14} /> Models are talking · turn {dialogue.turn} of {dialogue.total}
          <button className="btn small" onClick={() => st().stopAll()}>
            <Square size={12} /> Stop
          </button>
        </div>
      )}

      <div className={cx('composer', selection.length > 1 && 'is-merge')}>
        <div className="composer-top">
          <ContextChips />
          {selection.length > 0 && (
            <button className="chip-x" title="Start a new root instead (Esc)" onClick={() => st().select([])}>
              <X size={13} />
            </button>
          )}
          <span className="grow" />
          <span
            className={cx('ctx-meter', pct > 100 * 0.85 && 'warn', tokens > numCtx && 'over')}
            title="Estimated tokens the model will read for this message (≈4 characters per token). The bar fills toward the context window set in Settings."
          >
            <span className="bar">
              <span style={{ width: `${pct}%` }} />
            </span>
            ≈{fmtTokens(tokens)} / {fmtTokens(numCtx)}
          </span>
        </div>

        <textarea
          ref={ref}
          value={draft}
          rows={1}
          placeholder={placeholder}
          onChange={(e) => st().setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (canSend) st().send()
            }
          }}
        />

        <div className="composer-bottom">
          <ModelPicker />
          <button className="btn ghost" onClick={() => st().setModal('dialogue')} disabled={!!dialogue}>
            <MessagesSquare size={14} /> Make them talk
          </button>
          {selection.length === 1 && (
            <button className="btn ghost" onClick={() => st().summarize(selection[0])} title="Condense this thread into a checkpoint node">
              <Layers size={14} /> Checkpoint
            </button>
          )}
          <span className="grow" />
          {anyBusy && (
            <button className="btn" onClick={() => st().stopAll()} title="Stop all generation">
              <Square size={12} /> Stop
            </button>
          )}
          <button className="btn primary send" disabled={!canSend} onClick={() => st().send()} title="Send (Enter)">
            <ArrowUp size={15} />
            {live.length > 1 ? `Send to ${live.length}` : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
