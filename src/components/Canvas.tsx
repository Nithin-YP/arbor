import { useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
} from '@xyflow/react'
import { GitBranch, GitMerge, Layers, LayoutGrid, Maximize, MessagesSquare } from 'lucide-react'
import { NODE_W, useStore } from '../store'
import { branchLabel } from '../lib/context'
import { modelColor } from '../lib/util'
import { ChatNode } from './ChatNode'

const nodeTypes = { chat: ChatNode }
const st = useStore.getState

function useEdges(): Edge[] {
  const structVersion = useStore((s) => s.structVersion)
  const pathSet = useStore((s) => s.pathSet)
  return useMemo(() => {
    const g = st().graph
    const edges: Edge[] = []
    for (const n of Object.values(g.nodes)) {
      n.parents.forEach((p, i) => {
        if (!g.nodes[p]) return
        const hot = pathSet.has(p) && pathSet.has(n.id)
        edges.push({
          id: `${p}->${n.id}`,
          source: p,
          target: n.id,
          type: 'smoothstep',
          className: hot ? 'edge-hot' : n.muted || g.nodes[p].muted ? 'edge-muted' : undefined,
          label: n.parents.length > 1 ? branchLabel(i) : undefined,
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 6,
          selectable: false,
        })
      })
    }
    return edges
    // structVersion stands in for "graph shape changed"; content edits don't move edges.
  }, [structVersion, pathSet])
}

function Viewport() {
  const { setCenter, getZoom, fitView, getInternalNode } = useReactFlow()
  const focusReq = useStore((s) => s.focusReq)
  const fitReq = useStore((s) => s.fitReq)

  useEffect(() => {
    if (!focusReq) return
    // Let React Flow mount a freshly added node first.
    const t = setTimeout(() => {
      const internal = getInternalNode(focusReq.id)
      const pos = internal?.internals.positionAbsolute ?? st().graph.nodes[focusReq.id]?.position
      if (!pos) return
      const zoom = Math.max(getZoom(), 0.85)
      // Pin the node's top ~70px below the canvas top rather than centring it:
      // replies grow downward while streaming, so this keeps them clear of the composer.
      const viewH = document.querySelector('.canvas')?.clientHeight ?? 800
      setCenter(pos.x + NODE_W / 2, pos.y + (viewH / 2 - 70) / zoom, { zoom, duration: 450 })
    }, 60)
    return () => clearTimeout(t)
  }, [focusReq, getInternalNode, getZoom, setCenter])

  // A loaded graph arrives after mount, so wait until its nodes are measured before fitting.
  const nodesReady = useNodesInitialized()
  useEffect(() => {
    if (!fitReq || !nodesReady) return
    // Extra bottom padding keeps the floating composer from covering the lowest nodes.
    const padding = { top: '50px', left: '50px', right: '50px', bottom: '200px' } as const
    const t = setTimeout(() => fitView({ padding, duration: 400, maxZoom: 1 }), 30)
    return () => clearTimeout(t)
  }, [fitReq, nodesReady, fitView])

  return null
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h2>Conversations as a graph</h2>
      <p>Type below to start. Every exchange becomes a node, and the highlighted path is exactly what the model reads.</p>
      <ul>
        <li>
          <GitBranch size={15} />
          <span>
            <b>Branch</b>: click any node and type. The old path stays intact.
          </span>
        </li>
        <li>
          <GitMerge size={15} />
          <span>
            <b>Merge</b>: Ctrl/Shift-click two nodes, then ask about both.
          </span>
        </li>
        <li>
          <Layers size={15} />
          <span>
            <b>Checkpoint</b>: summarize a long thread so later turns read less.
          </span>
        </li>
        <li>
          <MessagesSquare size={15} />
          <span>
            <b>Make them talk</b>: set two models on each other.
          </span>
        </li>
      </ul>
    </div>
  )
}

export function Canvas() {
  const rfNodes = useStore((s) => s.rfNodes)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const edges = useEdges()

  return (
    <div className="canvas">
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={1.75}
        nodesConnectable={false}
        deleteKeyCode={null}
        // Selection is ours, not React Flow's: its multi-select key tracking ignores
        // keys pressed while the composer has focus, which broke "type, then Ctrl-click
        // two nodes to merge". Reading modifiers off the click itself always works.
        elementsSelectable={false}
        selectionKeyCode={null}
        onNodeClick={(e, node) => {
          const s = st()
          if (e.ctrlKey || e.metaKey || e.shiftKey)
            s.select(s.selection.includes(node.id) ? s.selection.filter((x) => x !== node.id) : [...s.selection, node.id])
          else if (!(s.selection.length === 1 && s.selection[0] === node.id)) s.select([node.id])
        }}
        onPaneClick={() => st().selection.length && st().select([])}
        zoomOnDoubleClick={false}
        elevateNodesOnSelect
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#2a3040" />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          nodeColor={(n) => modelColor(st().graph.nodes[n.id]?.model)}
          nodeStrokeWidth={0}
          maskColor="rgba(8,10,14,0.72)"
        />
        <Controls showInteractive={false} position="bottom-left" />
        <Panel position="top-left" className="canvas-tools">
          <button className="btn ghost small" onClick={() => st().tidy()} title="Re-layout the whole graph">
            <LayoutGrid size={14} /> Tidy
          </button>
          <button className="btn ghost small" onClick={() => st().requestFit()} title="Fit everything in view">
            <Maximize size={14} /> Fit
          </button>
        </Panel>
        <Viewport />
      </ReactFlow>
      {rfNodes.length === 0 && <EmptyState />}
    </div>
  )
}
