import assert from 'node:assert/strict'
// Run with: npm test   (Node 22.6+ runs TypeScript directly)
import { contextNodeSet, deletionClosure, requestFor } from '../src/lib/context.ts'

let t = 0
const node = (id: string, parents: string[], extra: Record<string, unknown> = {}) => ({
  id, parents, kind: 'chat', status: 'done', position: { x: 0, y: 0 }, createdAt: t++, model: 'm1', ...extra,
})
const graph = (...nodes: any[]) => ({
  id: 'g', title: 't', systemPrompt: '', createdAt: 0, updatedAt: 0, version: 1,
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
})
const show = (msgs: any[]) => msgs.map((m) => `${m.role}: ${m.content.replace(/\n/g, ' âŽ ')}`)

// 1. linear thread
{
  const g = graph(
    node('a', [], { prompt: 'pA', response: 'rA' }),
    node('b', ['a'], { prompt: 'pB', response: 'rB' }),
    node('c', ['b'], { prompt: 'pC', status: 'pending' }),
  )
  assert.deepEqual(show(requestFor(g, 'c')), ['user: pA', 'assistant: rA', 'user: pB', 'assistant: rB', 'user: pC'])
  console.log('âœ“ linear thread')
}

// 2. siblings are invisible to each other
{
  const g = graph(
    node('a', [], { prompt: 'pA', response: 'rA' }),
    node('b1', ['a'], { prompt: 'pB1', response: 'rB1' }),
    node('b2', ['a'], { prompt: 'pB2', response: 'rB2' }),
    node('c', ['b2'], { prompt: 'pC', status: 'pending' }),
  )
  const out = show(requestFor(g, 'c')).join('|')
  assert.ok(!out.includes('B1'), 'sibling leaked')
  assert.ok(out.includes('rB2'))
  console.log('âœ“ branch isolation')
}

// 3. merge: shared prefix once, tails as labelled blocks, merge prompt last
{
  const g = graph(
    node('a', [], { prompt: 'pA', response: 'rA' }),
    node('b', ['a'], { prompt: 'pB', response: 'rB', model: 'llama' }),
    node('c', ['a'], { prompt: 'pC', response: 'rC', model: 'qwen' }),
    node('m', ['b', 'c'], { prompt: 'compare', status: 'pending' }),
  )
  const msgs = requestFor(g, 'm')
  assert.equal(msgs.length, 3, show(msgs).join('\n'))
  assert.deepEqual(show(msgs).slice(0, 2), ['user: pA', 'assistant: rA'])
  const last = msgs[2].content
  assert.equal(last.split('pA').length, 1, 'shared prefix repeated inside merge block')
  assert.ok(last.indexOf('<branch name="A">') < last.indexOf('rB') && last.indexOf('rB') < last.indexOf('<branch name="B">'))
  assert.ok(last.includes('Assistant (llama): rB') && last.includes('Assistant (qwen): rC'))
  assert.ok(last.trimEnd().endsWith('compare'))
  console.log('âœ“ merge (prefix once, A/B blocks, prompt last)')
}

// 4. mute skips a node but keeps its ancestors
{
  const g = graph(
    node('a', [], { prompt: 'pA', response: 'rA' }),
    node('b', ['a'], { prompt: 'pB', response: 'rB', muted: true }),
    node('c', ['b'], { prompt: 'pC', status: 'pending' }),
  )
  assert.deepEqual(show(requestFor(g, 'c')), ['user: pA', 'assistant: rA', 'user: pC'])
  console.log('âœ“ mute')
}

// 5. checkpoint replaces everything above it, and cuts the highlight
{
  const g = graph(
    node('a', [], { prompt: 'pA', response: 'rA' }),
    node('b', ['a'], { prompt: 'pB', response: 'rB' }),
    node('s', ['b'], { kind: 'summary', response: 'SUM' }),
    node('c', ['s'], { prompt: 'pC', status: 'pending' }),
  )
  const msgs = show(requestFor(g, 'c'))
  assert.equal(msgs.length, 1, msgs.join('\n'))
  assert.ok(msgs[0].includes('SUM') && msgs[0].includes('pC') && !msgs[0].includes('rA'))
  assert.deepEqual([...contextNodeSet(g, ['c'])].sort(), ['c', 's'])
  // and the summary node itself is generated from the full thread
  const sumReq = show(requestFor({ ...g, nodes: { ...g.nodes, s: { ...g.nodes.s, status: 'pending', response: '' } } }, 's'))
  assert.ok(sumReq.join('|').includes('rA') && sumReq.at(-1)!.includes('Summarize'))
  console.log('âœ“ checkpoint')
}

// 6. dialogue: each agent sees itself as assistant, others as tagged user
{
  const pro = { name: 'Pro', model: 'qwen', persona: 'argue for', color: '#fff' }
  const con = { name: 'Con', model: 'gemma', persona: 'argue against', color: '#000' }
  const g = graph(
    node('x', [], { prompt: 'Topic?', response: 'Yes because', agent: pro, peers: ['Con'], model: 'qwen' }),
    node('y', ['x'], { response: 'No because', agent: con, peers: ['Pro'], model: 'gemma' }),
    node('z', ['y'], { agent: pro, peers: ['Con'], model: 'qwen', status: 'pending' }),
  )
  const msgs = requestFor(g, 'z')
  assert.equal(msgs[0].role, 'system')
  assert.ok(msgs[0].content.includes('You are Pro') && msgs[0].content.includes('argue for'))
  assert.deepEqual(show(msgs.slice(1)), ['user: [User]: Topic?', 'assistant: Yes because', 'user: [Con]: No because'])
  const conView = show(requestFor({ ...g, nodes: { ...g.nodes, z: { ...g.nodes.z, agent: con, peers: ['Pro'] } } }, 'z').slice(1))
  assert.deepEqual(conView, ['user: [User]: Topic? âŽ  âŽ [Pro]: Yes because', 'assistant: No because', 'user: [Moderator]: Your turn, Con.'])
  console.log('âœ“ dialogue perspective (Pro and Con views)')
}

// 7. deleting a node removes only descendants that lose every parent
{
  const g = graph(
    node('a', []), node('b', ['a']), node('c', ['a']), node('m', ['b', 'c']), node('d', ['b']),
  )
  assert.deepEqual([...deletionClosure(g, ['b'])].sort(), ['b', 'd'])
  console.log('âœ“ deletion closure keeps merges with a surviving parent')
}
console.log('all context tests passed')

