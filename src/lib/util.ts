export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

function hashHue(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0
  return h % 360
}

/** Stable per-model colour, so the same model looks the same everywhere. */
export const modelColor = (model?: string) => (model ? `hsl(${hashHue(model)} 78% 70%)` : '#8b93a7')

export const shortModel = (model?: string) => (model ? model.replace(/:latest$/, '') : 'no model')

export const AGENT_COLORS = ['#7c9cff', '#ff8fa3', '#5fd3a6', '#ffc66d', '#c49bff', '#62d0ff']

export function fmtTokens(n: number) {
  if (n < 1000) return String(Math.round(n))
  return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'
}

export function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
  if (b >= 1e6) return (b / 1e6).toFixed(0) + ' MB'
  return (b / 1e3).toFixed(0) + ' KB'
}

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(ts).toLocaleDateString()
}

export function snippet(text: string | undefined, n = 60) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

/** Some reasoning models inline their chain of thought as <think>…</think>. */
export function splitThink(raw: string): { thinking: string; answer: string } {
  const m = raw.match(/^\s*<think>([\s\S]*?)(<\/think>|$)/)
  if (!m) return { thinking: '', answer: raw }
  const closed = m[2] === '</think>'
  return { thinking: m[1].trim(), answer: closed ? raw.slice((m.index ?? 0) + m[0].length).trimStart() : '' }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Agents often echo their own name ("[Skeptic]: …"); strip it. */
export function stripSelfPrefix(text: string, name?: string) {
  if (!name) return text
  return text.replace(new RegExp(`^\\s*\\**\\[?${escapeRe(name)}\\]?\\**\\s*:\\s*`, 'i'), '')
}
