import * as dagre from '@dagrejs/dagre'
import type { Node } from '@xyflow/react'
import type { Graph } from '../types'

/** Top-to-bottom layered layout using each node's measured size. */
export function tidyPositions(g: Graph, rfNodes: Node[], width: number) {
  const dg = new dagre.graphlib.Graph()
  dg.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 80, marginx: 20, marginy: 20 })
  dg.setDefaultEdgeLabel(() => ({}))
  const sizes = new Map(rfNodes.map((n) => [n.id, { w: n.measured?.width ?? width, h: n.measured?.height ?? 180 }]))
  for (const n of Object.values(g.nodes)) {
    const s = sizes.get(n.id) ?? { w: width, h: 180 }
    dg.setNode(n.id, { width: s.w, height: s.h })
  }
  for (const n of Object.values(g.nodes)) for (const p of n.parents) if (g.nodes[p]) dg.setEdge(p, n.id)
  dagre.layout(dg)
  const out: Record<string, { x: number; y: number }> = {}
  for (const n of Object.values(g.nodes)) {
    const d = dg.node(n.id)
    const s = sizes.get(n.id) ?? { w: width, h: 180 }
    if (d) out[n.id] = { x: Math.round(d.x - s.w / 2), y: Math.round(d.y - s.h / 2) }
  }
  return out
}
