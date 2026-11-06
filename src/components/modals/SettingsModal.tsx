import { Settings } from 'lucide-react'
import { useStore } from '../../store'
import { fmtTokens } from '../../lib/util'
import { Modal } from './Modal'

const CTX_OPTIONS = [2048, 4096, 8192, 16384, 32768, 65536]

export function SettingsModal() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const systemPrompt = useStore((s) => s.graph.systemPrompt)
  const setSystemPrompt = useStore((s) => s.setSystemPrompt)

  return (
    <Modal
      title={
        <>
          <Settings size={18} /> Settings
        </>
      }
    >
      <label className="field">
        <span>System prompt for this graph</span>
        <textarea
          className="input"
          rows={3}
          value={systemPrompt}
          placeholder="Optional. Sent first in every request in this graph (and prepended to each persona's brief)."
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </label>

      <label className="field inline">
        <span>Temperature</span>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={settings.temperature}
          onChange={(e) => setSettings({ temperature: +e.target.value })}
        />
        <b>{settings.temperature.toFixed(2)}</b>
      </label>

      <div className="field">
        <span>Reasoning (thinking models such as qwen3, deepseek-r1)</span>
        <div className="seg">
          <button className={settings.think === 'auto' ? 'on' : ''} onClick={() => setSettings({ think: 'auto' })}>
            Model default
          </button>
          <button className={settings.think === 'off' ? 'on' : ''} onClick={() => setSettings({ think: 'off' })}>
            Off (faster)
          </button>
        </div>
        <small className="muted-text">Small CPU models can spend most of their time thinking. Turn it off for snappier dialogues.</small>
      </div>

      <div className="field">
        <span>Context window (num_ctx)</span>
        <div className="seg">
          {CTX_OPTIONS.map((n) => (
            <button key={n} className={settings.numCtx === n ? 'on' : ''} onClick={() => setSettings({ numCtx: n })}>
              {fmtTokens(n)}
            </button>
          ))}
        </div>
        <small className="muted-text">
          Ollama silently drops the oldest context beyond this. Bigger windows need more RAM/VRAM; merges and long dialogues need
          the room.
        </small>
      </div>

      <label className="field">
        <span>Ollama URL</span>
        <input
          className="input"
          value={settings.ollamaUrl}
          spellCheck={false}
          onChange={(e) => setSettings({ ollamaUrl: e.target.value.replace(/\/+$/, '') })}
        />
        <small className="muted-text">
          <code>/ollama</code> goes through the dev server's proxy to <code>127.0.0.1:11434</code>. To call another machine
          directly, use its URL and allow this origin with <code>OLLAMA_ORIGINS</code>.
        </small>
      </label>
    </Modal>
  )
}
