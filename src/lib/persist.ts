import { createStore, del, entries, get, set } from 'idb-keyval'
import type { Graph, GraphMeta } from '../types'
import { uid } from './util'

// IndexedDB, not localStorage: graphs full of long model replies outgrow the ~5 MB localStorage cap fast.
const db = createStore('arbor-db', 'graphs')

export const saveGraph = (g: Graph) => set(g.id, g, db)
export const loadGraphById = (id: string) => get<Graph>(id, db)
export const deleteGraph = (id: string) => del(id, db)

export async function listGraphs(): Promise<GraphMeta[]> {
  const all = await entries<string, Graph>(db)
  return all
    .map(([, g]) => ({ id: g.id, title: g.title, updatedAt: g.updatedAt, nodeCount: Object.keys(g.nodes).length }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Nodes that were mid-generation when the graph was saved can't resume. */
export function sanitizeGraph(g: Graph): Graph {
  const nodes = { ...g.nodes }
  for (const [id, n] of Object.entries(nodes))
    if (n.status === 'streaming' || n.status === 'pending')
      nodes[id] = { ...n, status: n.response ? 'done' : 'error', error: 'Interrupted (page was closed mid-reply)' }
  return { ...g, nodes, systemPrompt: g.systemPrompt ?? '' }
}

export function parseGraphFile(text: string): Graph {
  const g = JSON.parse(text) as Graph
  if (!g || typeof g !== 'object' || typeof g.nodes !== 'object' || !g.nodes)
    throw new Error('Not an Arbor graph file (missing "nodes").')
  for (const n of Object.values(g.nodes)) {
    if (!n.id || !Array.isArray(n.parents)) throw new Error('Corrupt node in graph file.')
    n.position ??= { x: 0, y: 0 }
    n.kind ??= 'chat'
    n.status ??= 'done'
  }
  // Fresh id so importing never overwrites a graph already in the library.
  return sanitizeGraph({ ...g, id: uid(), title: g.title || 'Imported graph', version: 1, updatedAt: Date.now() })
}

export function downloadGraph(g: Graph) {
  const slug = (g.title || 'graph').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'graph'
  const blob = new Blob([JSON.stringify(g, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${slug}.arbor.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function pickGraphFile(): Promise<Graph | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        resolve(parseGraphFile(await file.text()))
      } catch (e) {
        reject(e)
      }
    }
    input.click()
  })
}
