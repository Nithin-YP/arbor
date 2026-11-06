import { useCallback, useEffect, useState } from 'react'
import { Copy, FilePlus, FolderOpen, Trash, Upload } from 'lucide-react'
import { useStore } from '../../store'
import { deleteGraph, listGraphs, loadGraphById, sanitizeGraph, saveGraph } from '../../lib/persist'
import { cx, timeAgo, uid } from '../../lib/util'
import type { GraphMeta } from '../../types'
import { importGraphFlow } from '../TopBar'
import { Modal } from './Modal'

const st = useStore.getState

export function LibraryModal() {
  const currentId = useStore((s) => s.graph.id)
  const [items, setItems] = useState<GraphMeta[] | null>(null)

  const refresh = useCallback(async () => setItems(await listGraphs()), [])
  useEffect(() => {
    void (async () => {
      await st().saveNow()
      await refresh()
    })()
  }, [refresh])

  const open = async (id: string) => {
    if (id === currentId) return st().setModal(null)
    await st().saveNow()
    const g = await loadGraphById(id)
    if (!g) return st().showToast('That graph is gone.', 'error')
    st().loadGraph(sanitizeGraph(g))
    st().setModal(null)
  }

  const duplicate = async (id: string) => {
    const g = await loadGraphById(id)
    if (!g) return
    await saveGraph({ ...g, id: uid(), title: `${g.title} (copy)`, updatedAt: Date.now() })
    await refresh()
  }

  // Two-step, in-app confirmation: native confirm() is suppressed in embedded browsers.
  const [confirming, setConfirming] = useState<string | null>(null)
  const remove = async (m: GraphMeta) => {
    setConfirming(null)
    await deleteGraph(m.id)
    if (m.id === currentId) st().newGraph()
    st().showToast(`Deleted “${m.title || 'Untitled'}”`)
    await refresh()
  }

  return (
    <Modal
      title={
        <>
          <FolderOpen size={18} /> Library
        </>
      }
      subtitle="Graphs autosave in this browser. Export to a .json file to back one up or move it to another machine."
      footer={
        <>
          <button className="btn" onClick={() => void importGraphFlow().then(() => st().setModal(null))}>
            <Upload size={14} /> Import .json
          </button>
          <span className="grow" />
          <button
            className="btn primary"
            onClick={async () => {
              await st().saveNow()
              st().newGraph()
              st().setModal(null)
            }}
          >
            <FilePlus size={14} /> New graph
          </button>
        </>
      }
    >
      {items === null ? (
        <div className="muted-text">Loading…</div>
      ) : items.length === 0 ? (
        <div className="panel-empty muted-text">Nothing saved yet. Graphs appear here once they have a node.</div>
      ) : (
        <div className="lib-list">
          {items.map((m) =>
            confirming === m.id ? (
              <div key={m.id} className="lib-item confirming">
                <div className="lib-main">
                  <b>{m.title || 'Untitled'}</b>
                  <span className="lib-confirm">
                    Delete these {m.nodeCount} node{m.nodeCount === 1 ? '' : 's'} for good? Export first if you want a copy.
                  </span>
                </div>
                <button className="btn small" onClick={() => setConfirming(null)} autoFocus>
                  Cancel
                </button>
                <button className="btn small danger" onClick={() => void remove(m)}>
                  <Trash size={13} /> Delete
                </button>
              </div>
            ) : (
            <div key={m.id} className={cx('lib-item', m.id === currentId && 'current')} onClick={() => void open(m.id)}>
              <div className="lib-main">
                <b>{m.title || 'Untitled'}</b>
                <span className="muted-text">
                  {m.nodeCount} node{m.nodeCount === 1 ? '' : 's'} · edited {timeAgo(m.updatedAt)}
                  {m.id === currentId && ' · open now'}
                </span>
              </div>
              <button
                className="icon-btn"
                title="Duplicate"
                onClick={(e) => {
                  e.stopPropagation()
                  void duplicate(m.id)
                }}
              >
                <Copy size={14} />
              </button>
              <button
                className="icon-btn danger"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirming(m.id)
                }}
              >
                <Trash size={14} />
              </button>
            </div>
            ),
          )}
        </div>
      )}
    </Modal>
  )
}
