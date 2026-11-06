# Arbor: graph chat for local LLMs

Conversations as a graph instead of a list. Every exchange is a node, and the
model only ever reads the path that leads to the node you are replying to.
Runs entirely on your machine through [Ollama](https://ollama.com): no keys, no cost.

## Run it

```bash
ollama serve          # or just have the Ollama app running
npm install
npm run dev           # http://localhost:5180
```

No models yet? Click **Pull a model** in the app (or `ollama pull qwen3:0.6b`).

## What you can do

| Action | How | What the model sees |
|---|---|---|
| **Chat** | Type in the composer | The highlighted path, root to here |
| **Branch** | Click any earlier node, type | That node's path only; siblings are invisible |
| **Fan-out** | Pick several models in the picker | Same prompt, one sibling branch per model |
| **Merge** | Ctrl/Shift-click 2+ nodes, type | Shared history once, then each branch as a labelled block |
| **Mute** | Eye icon on a node | The node stays on the canvas but is skipped in context |
| **Checkpoint** | Layers icon / *Checkpoint* | A summary node that replaces everything above it |
| **Make them talk** | *Make them talk* button | Personas on any models, taking turns as nodes |
| **Edit as branch** | Node tab → *Edit as new branch* | The edited prompt becomes a sibling; the original stays |

- **Thread** tab: read the selected path as a normal chat.
- **Context** tab: the exact message list the next request will send, with a token estimate against `num_ctx`.
- **Save / load**: graphs autosave to IndexedDB (*Library*), and export/import as `.arbor.json` files.

Shortcuts: `Enter` send · `Shift+Enter` newline · `/` focus composer · `Esc` deselect · `Del` delete · `Ctrl+S` save.

## How context is built (`src/lib/context.ts`)

1. `transcriptOf(node)` walks up the ancestry. Muted nodes pass their history through but add nothing;
   a finished summary node stops the walk.
2. For merges, `contextFor(parents)` finds the longest shared prefix of the parents' transcripts
   (the merge base) and packs each divergent tail into a `<branch name="A">…</branch>` block.
3. `toMessages(turns, speaker)` renders for one speaker: their own lines become `assistant`, everyone
   else's become `user` tagged `[Name]: …`. That is what lets different models hold a conversation.

## Stack

React 19 · @xyflow/react (canvas) · zustand (state) · dagre (Tidy layout) · idb-keyval (storage) · Vite (dev server + `/ollama` proxy).
