import type { ChatMessage, NodeStats } from '../types'

export interface ModelInfo {
  name: string
  size: number
  family?: string
  params?: string
}

async function errorText(r: Response) {
  const raw = await r.text().catch(() => '')
  try {
    return (JSON.parse(raw).error as string) || `HTTP ${r.status}`
  } catch {
    return raw.trim() || `HTTP ${r.status}`
  }
}

export async function listModels(base: string): Promise<ModelInfo[]> {
  const r = await fetch(`${base}/api/tags`)
  if (!r.ok) throw new Error(await errorText(r))
  const j = await r.json()
  return (j.models ?? [])
    .map((m: { name: string; size: number; details?: { family?: string; parameter_size?: string } }) => ({
      name: m.name,
      size: m.size,
      family: m.details?.family,
      params: m.details?.parameter_size,
    }))
    .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name))
}

/** Reads Ollama's newline-delimited JSON stream, one object per line. */
async function* ndjson(r: Response, signal: AbortSignal) {
  const reader = r.body!.pipeThrough(new TextDecoderStream()).getReader()
  const onAbort = () => reader.cancel().catch(() => {})
  signal.addEventListener('abort', onAbort)
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += value
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (line) yield JSON.parse(line)
      }
    }
    if (buf.trim()) yield JSON.parse(buf)
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

export async function streamChat(opts: {
  base: string
  model: string
  messages: ChatMessage[]
  temperature: number
  numCtx: number
  think?: boolean
  signal: AbortSignal
  onDelta: (d: { content?: string; thinking?: string }) => void
}): Promise<NodeStats> {
  const request = (think?: boolean) =>
    fetch(`${opts.base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        stream: true,
        ...(think === undefined ? {} : { think }),
        // Ollama's default context window is small and it truncates silently;
        // merged branches get long, so we always set it explicitly.
        options: { temperature: opts.temperature, num_ctx: opts.numCtx },
      }),
      signal: opts.signal,
    })
  let r = await request(opts.think)
  if (!r.ok && opts.think !== undefined) {
    // Models without a reasoning mode may reject the flag: retry once without it.
    const msg = await errorText(r)
    if (!/think/i.test(msg)) throw new Error(msg)
    r = await request(undefined)
  }
  if (!r.ok || !r.body) throw new Error(await errorText(r))
  let stats: NodeStats = {}
  for await (const j of ndjson(r, opts.signal)) {
    if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (j.error) throw new Error(j.error)
    const content = j.message?.content
    const thinking = j.message?.thinking
    if (content || thinking) opts.onDelta({ content, thinking })
    if (j.done)
      stats = {
        promptTokens: j.prompt_eval_count,
        cachedTokens: j.prompt_eval_cached_count,
        outputTokens: j.eval_count,
        ms: j.total_duration ? j.total_duration / 1e6 : undefined,
      }
  }
  if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return stats
}

export async function pullModel(
  base: string,
  name: string,
  onProgress: (p: { status: string; completed?: number; total?: number }) => void,
  signal: AbortSignal,
) {
  const r = await fetch(`${base}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, stream: true }),
    signal,
  })
  if (!r.ok || !r.body) throw new Error(await errorText(r))
  for await (const j of ndjson(r, signal)) {
    if (j.error) throw new Error(j.error)
    onProgress({ status: j.status, completed: j.completed, total: j.total })
  }
}
