import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Brain,
  Copy,
  Eye,
  EyeOff,
  GitMerge,
  Layers,
  MessagesSquare,
  Pencil,
  RotateCcw,
  Trash,
} from 'lucide-react'
import { deleteWithUndo, useStore, type Tab } from '../store'
import { childrenMap, contextFor, estimateTokens, previewFor, transcriptOf } from '../lib/context'
import { cx, fmtTokens, modelColor, shortModel, timeAgo } from '../lib/util'
import type { Turn } from '../types'
import { Markdown } from './Markdown'

const st = useStore.getState

function TurnView({ t }: { t: Turn }) {
  const node = useStore((s) => (t.nodeId ? s.graph.nodes[t.nodeId] : undefined))
  const [open, setOpen] = useState(false)
  const go = () => {
    if (node) {
      st().select([node.id])
      st().focus(node.id)
    }
  }

  if (t.kind === 'merge')
    return (
      <div className="turn card merge-card">
        <button className="card-head" onClick={() => setOpen((o) => !o)}>
          <GitMerge size={13} /> Merged branches <span className="muted-text">{open ? 'hide' : 'show what the model reads'}</span>
        </button>
        {open && <pre className="raw">{t.text}</pre>}
      </div>
    )

  if (t.kind === 'summary')
    return (
      <div className="turn card summary-card" onClick={go}>
        <div className="card-head">
          <Layers size={13} /> Checkpoint: everything above it is replaced by this summary
        </div>
        <Markdown text={t.text.replace(/^Summary of the earlier conversation:\s*/, '')} />
      </div>
    )

  if (t.role === 'user')
    return (
      <div className="turn user" onClick={go}>
        <div className="bubble">{t.text}</div>
      </div>
    )

  return (
    <div className="turn bot" onClick={go}>
      <div className="who">
        {node?.agent && (
          <span className="agent-pill" style={{ '--c': node.agent.color } as CSSProperties}>
            {node.agent.name}
          </span>
        )}
        <span className="model-chip" style={{ '--model': modelColor(t.model) } as CSSProperties}>
          <span className="dot" />
          {shortModel(t.model)}
        </span>
      </div>
      {node?.thinking && (
        <details className="think" onClick={(e) => e.stopPropagation()}>
          <summary>
            <Brain size={12} /> Reasoning
          </summary>
          <pre>{node.thinking}</pre>
        </details>
      )}
      <div className="bubble">
        <Markdown text={t.text} />
      </div>
    </div>
  )
}

function ThreadTab() {
  const graph = useStore((s) => s.graph)
  const selection = useStore((s) => s.selection)
  const endRef = useRef<HTMLDivElement>(null)
  const turns = useMemo(
    () =>
      selection.length === 0 ? [] : selection.length === 1 ? transcriptOf(graph, selection[0]) : contextFor(graph, selection),
    [graph, selection],
  )
  const sel = selection.length === 1 ? graph.nodes[selection[0]] : undefined

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [selection])

  if (!selection.length)
    return (
      <div className="panel-empty">
        <p>Select a node to read its thread as a normal chat.</p>
        <p className="muted-text">The highlighted path on the canvas is exactly the context the model sees.</p>
      </div>
    )

  return (
    <div className="thread">
      {selection.length > 1 && (
        <div className="hint-box">
          <GitMerge size={14} /> Preview of a merge. Your next message will see the shared history once, then each branch as a labelled block.
        </div>
      )}
      {turns.length === 0 && <div className="panel-empty muted-text">Nothing in context yet.</div>}
      {turns.map((t) => (
        <TurnView key={t.key} t={t} />
      ))}
      {sel?.muted && <div className="hint-box">This node is muted: it stays on the canvas but is skipped in every context.</div>}
      {sel?.status === 'streaming' && !sel.response && <div className="typing"><i /><i /><i /></div>}
      <div ref={endRef} />
    </div>
  )
}

function ContextTab() {
  const graph = useStore((s) => s.graph)
  const selection = useStore((s) => s.selection)
  const draft = useStore((s) => s.draft)
  const numCtx = useStore((s) => s.settings.numCtx)
  const msgs = useMemo(() => previewFor(graph, selection, draft), [graph, selection, draft])
  const tokens = estimateTokens(msgs)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  return (
    <div className="ctx-tab">
      <div className="ctx-summary">
        <b>Next request</b>: {msgs.length} message{msgs.length === 1 ? '' : 's'} · ≈{fmtTokens(tokens)} tokens of {fmtTokens(numCtx)}
        <div className="bar big">
          <span style={{ width: `${Math.min(100, (tokens / numCtx) * 100)}%` }} className={cx(tokens > numCtx && 'over')} />
        </div>
        {tokens > numCtx && (
          <p className="warn-text">
            This is larger than the context window, so Ollama will drop the oldest part. Add a checkpoint (summary) or raise the window in Settings.
          </p>
        )}
        <p className="muted-text">
          This is the exact message list sent to the model when you press Send{draft.trim() ? ' (including your draft)' : ''}.
        </p>
      </div>
      {msgs.length === 0 && <div className="panel-empty muted-text">Empty: a new root conversation starts with no context.</div>}
      {msgs.map((m, i) => {
        const long = m.content.length > 700
        const open = expanded[i] || !long
        return (
          <div key={i} className={cx('msg', m.role)}>
            <div className="msg-role">
              {m.role}
              <span>≈{fmtTokens(Math.ceil(m.content.length / 4))} tok</span>
            </div>
            <pre>{open ? m.content : m.content.slice(0, 700) + '…'}</pre>
            {long && (
              <button className="link" onClick={() => setExpanded((e) => ({ ...e, [i]: !open }))}>
                {open ? 'collapse' : 'show all'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function NodeTab() {
  const selection = useStore((s) => s.selection)
  const graph = useStore((s) => s.graph)
  const lastDialogue = useStore((s) => s.lastDialogue)
  const n = selection.length === 1 ? graph.nodes[selection[0]] : undefined
  const kids = useMemo(() => (n ? (childrenMap(graph).get(n.id) ?? []).length : 0), [graph, n])
  if (!n) return <div className="panel-empty muted-text">Select a single node to see its details and actions.</div>

  const busy = n.status === 'streaming' || n.status === 'pending'
  const tps = n.stats?.outputTokens && n.stats.ms ? (n.stats.outputTokens / (n.stats.ms / 1000)).toFixed(1) : null
  const row = (k: string, v: ReactNode) => (
    <div className="kv">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  )

  return (
    <div className="node-tab">
      <div className="kv-list">
        {row('Kind', n.kind === 'summary' ? 'Checkpoint (summary)' : n.parents.length > 1 ? `Merge of ${n.parents.length} branches` : n.parents.length ? 'Continuation' : 'Root')}
        {row('Model', <span className="model-chip" style={{ '--model': modelColor(n.model) } as CSSProperties}><span className="dot" />{shortModel(n.model)}</span>)}
        {n.agent && row('Speaker', <span className="agent-pill" style={{ '--c': n.agent.color } as CSSProperties}>{n.agent.name}</span>)}
        {row('Status', n.status + (n.stale ? ' · stale' : '') + (n.muted ? ' · muted' : ''))}
        {n.stats?.promptTokens !== undefined &&
          row(
            'Tokens read',
            fmtTokens(n.stats.promptTokens) +
              (n.stats.cachedTokens ? ` (${fmtTokens(n.stats.cachedTokens)} from cache)` : ''),
          )}
        {n.stats?.outputTokens !== undefined && row('Tokens written', fmtTokens(n.stats.outputTokens))}
        {n.stats?.ms !== undefined && row('Time', `${(n.stats.ms / 1000).toFixed(1)} s${tps ? ` · ${tps} tok/s` : ''}`)}
        {row('Children', kids)}
        {row('Created', timeAgo(n.createdAt))}
      </div>
      {n.agent?.persona && (
        <div className="persona">
          <b>{n.agent.name}'s brief</b>
          <p>{n.agent.persona}</p>
        </div>
      )}
      {n.error && <div className="gnode-error">{n.error}</div>}

      <div className="action-grid">
        <button className="btn" disabled={busy} onClick={() => st().regenerate(n.id)}>
          <RotateCcw size={14} /> Regenerate
        </button>
        {n.prompt !== undefined && (
          <button className="btn" onClick={() => st().editAndBranch(n.id)}>
            <Pencil size={14} /> Edit as new branch
          </button>
        )}
        <button className="btn" onClick={() => st().toggleMute(n.id)}>
          {n.muted ? <Eye size={14} /> : <EyeOff size={14} />} {n.muted ? 'Unmute' : 'Mute in context'}
        </button>
        {n.kind !== 'summary' && (
          <button className="btn" onClick={() => st().summarize(n.id)}>
            <Layers size={14} /> Checkpoint here
          </button>
        )}
        {(n.agent || lastDialogue) && (
          <button className="btn" onClick={() => st().setModal('dialogue')}>
            <MessagesSquare size={14} /> Continue dialogue
          </button>
        )}
        <button
          className="btn"
          disabled={!n.response}
          onClick={() => {
            void navigator.clipboard.writeText(n.response ?? '')
            st().showToast('Reply copied')
          }}
        >
          <Copy size={14} /> Copy reply
        </button>
        <button className="btn danger" onClick={() => deleteWithUndo([n.id])}>
          <Trash size={14} /> Delete
        </button>
      </div>
    </div>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'thread', label: 'Thread' },
  { id: 'context', label: 'Context' },
  { id: 'node', label: 'Node' },
]

export function Inspector() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  return (
    <aside className="inspector">
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={cx('tab', tab === t.id && 'on')} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="inspector-body">
        {tab === 'thread' && <ThreadTab />}
        {tab === 'context' && <ContextTab />}
        {tab === 'node' && <NodeTab />}
      </div>
    </aside>
  )
}
