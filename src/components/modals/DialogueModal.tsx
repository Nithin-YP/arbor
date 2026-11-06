import { useState, type CSSProperties } from 'react'
import { MessagesSquare, Play, Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import { branchLabel } from '../../lib/context'
import { AGENT_COLORS, cx, shortModel, snippet } from '../../lib/util'
import type { Agent } from '../../types'
import { Modal } from './Modal'

const PRESETS: { name: string; agents: [string, string][]; topic: string }[] = [
  {
    name: 'Debate',
    topic: 'Should a small team build its first product as a monolith or as microservices?',
    agents: [
      ['Advocate', 'Argue FOR the proposition. Be concrete, use examples, concede genuinely good points but defend your position.'],
      ['Skeptic', 'Argue AGAINST the proposition. Probe weak assumptions, failure modes and missing evidence.'],
    ],
  },
  {
    name: 'Brainstorm',
    topic: 'Ideas for a final-year project that combines reinforcement learning and LLMs.',
    agents: [
      ['Builder', 'Propose concrete, ambitious ideas and build on what the others say.'],
      ['Critic', 'Stress-test each idea: name its biggest risk, then suggest a fix. Keep the best parts.'],
    ],
  },
  {
    name: 'Interview',
    topic: 'How do transformers actually use their context window?',
    agents: [
      ['Interviewer', 'Ask one sharp question at a time. Follow up whenever an answer is vague.'],
      ['Expert', 'Answer with depth, concrete examples and honest uncertainty.'],
    ],
  },
  {
    name: 'Tutor',
    topic: 'Explain the Bellman equation.',
    agents: [
      ['Teacher', 'Explain step by step and check understanding with a quick question.'],
      ['Student', 'Ask naive-but-sharp questions and restate what you learned in your own words.'],
    ],
  },
]

export function DialogueModal() {
  const models = useStore((s) => s.models)
  const selection = useStore((s) => s.selection)
  const nodes = useStore((s) => s.graph.nodes)
  const last = useStore((s) => s.lastDialogue)
  const pick = (i: number) => models[i % Math.max(1, models.length)]?.name ?? ''

  const fromPreset = (p: (typeof PRESETS)[number]): Agent[] =>
    p.agents.map(([name, persona], i) => ({ name, persona, model: pick(i), color: AGENT_COLORS[i] }))

  const [agents, setAgents] = useState<Agent[]>(() => last?.agents ?? fromPreset(PRESETS[0]))
  const [topic, setTopic] = useState(() => (selection.length ? '' : (last?.topic ?? PRESETS[0].topic)))
  const [turns, setTurns] = useState(() => last?.turns ?? 6)

  const update = (i: number, p: Partial<Agent>) => setAgents((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const names = agents.map((a) => a.name.trim())
  const problems = [
    agents.some((a) => !a.name.trim()) && 'Every participant needs a name.',
    new Set(names).size !== names.length && 'Names must be different.',
    agents.some((a) => !models.some((m) => m.name === a.model)) && 'Every participant needs an installed model.',
    !selection.length && !topic.trim() && 'Give them something to talk about.',
  ].filter(Boolean) as string[]

  const from =
    selection.length === 0
      ? 'a new conversation'
      : selection.length === 1
        ? `“${snippet(nodes[selection[0]]?.prompt || nodes[selection[0]]?.response, 50)}” (they read its whole thread)`
        : `a merge of ${selection.map((_, i) => branchLabel(i)).join(' + ')}`

  const start = () => {
    if (problems.length) return
    void useStore.getState().runDialogue({
      agents: agents.map((a) => ({ ...a, name: a.name.trim() })),
      topic,
      turns,
    })
  }

  return (
    <Modal
      wide
      title={
        <>
          <MessagesSquare size={18} /> Make them talk
        </>
      }
      subtitle={
        <>
          Each participant is a persona on a model of your choice. Turns go round-robin, each one becomes a node, and every speaker
          sees its own lines as its own and everyone else's as incoming messages. Starts from {from}.
        </>
      }
      footer={
        <>
          <span className="warn-text">{problems[0]}</span>
          <span className="grow" />
          <button className="btn" onClick={() => useStore.getState().setModal(null)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!!problems.length} onClick={start}>
            <Play size={14} /> Start {turns} turns
          </button>
        </>
      }
    >
      <div className="preset-row">
        <span className="muted-text">Presets</span>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            className="chip"
            onClick={() => {
              setAgents(fromPreset(p))
              if (!selection.length) setTopic(p.topic)
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="agents">
        {agents.map((a, i) => (
          <div key={i} className="agent-card" style={{ '--c': a.color } as CSSProperties}>
            <div className="agent-row">
              <button
                className="swatch"
                title="Change colour"
                onClick={() => update(i, { color: AGENT_COLORS[(AGENT_COLORS.indexOf(a.color) + 1) % AGENT_COLORS.length] })}
              />
              <input className="input name" value={a.name} placeholder="Name" onChange={(e) => update(i, { name: e.target.value })} />
              <select className="input" value={a.model} onChange={(e) => update(i, { model: e.target.value })}>
                {!models.some((m) => m.name === a.model) && <option value={a.model}>{a.model ? `${shortModel(a.model)} (missing)` : 'Pick a model'}</option>}
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {shortModel(m.name)}
                  </option>
                ))}
              </select>
              {agents.length > 2 && (
                <button className="icon-btn" title="Remove" onClick={() => setAgents((x) => x.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              )}
            </div>
            <textarea
              className="input"
              rows={2}
              value={a.persona}
              placeholder="Role / instructions for this participant"
              onChange={(e) => update(i, { persona: e.target.value })}
            />
          </div>
        ))}
        {agents.length < 4 && (
          <button
            className={cx('agent-card add')}
            onClick={() =>
              setAgents((x) => [
                ...x,
                { name: `Voice ${x.length + 1}`, persona: '', model: pick(x.length), color: AGENT_COLORS[x.length % AGENT_COLORS.length] },
              ])
            }
          >
            <Plus size={15} /> Add participant
          </button>
        )}
      </div>

      <label className="field">
        <span>{selection.length ? 'Steer them (optional)' : 'Topic / opening line'}</span>
        <textarea
          className="input"
          rows={2}
          value={topic}
          placeholder={selection.length ? 'Leave empty to just continue from the selected node' : 'What should they discuss?'}
          onChange={(e) => setTopic(e.target.value)}
        />
      </label>

      <label className="field inline">
        <span>Turns</span>
        <input type="range" min={2} max={20} value={turns} onChange={(e) => setTurns(+e.target.value)} />
        <b>{turns}</b>
      </label>
      {models.length < 2 && (
        <p className="muted-text">Tip: with only one model installed, both personas share it. Pull a second model to hear two different minds.</p>
      )}
    </Modal>
  )
}
