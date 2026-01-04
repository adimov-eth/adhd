# Notes Service Architecture

## The Experiment

This service exists to answer a question: **Does Anthropic's memory tool produce better AI continuity than structured retrieval we design ourselves?**

We don't know the answer. So we build both.

---

## Core Principle

Every note is stored twice:

1. **Raw Log** — Append-only, immutable, queryable. Our source of truth.
2. **Claude's Memory** — Whatever Claude decides to remember, organized however it sees fit.

The raw log is insurance. Claude's memory is the experiment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           CLIENT                                 │
│            (Telegram bot, web, mobile, CLI)                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ POST /notes { user_id, content, source }
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKER                            │
│                        (notes-api)                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      WRITE PATH                              ││
│  │                                                              ││
│  │  1. Validate input                                           ││
│  │  2. Generate note ID (ULID)                                  ││
│  │  3. INSERT into D1 (raw log)                                 ││
│  │  4. Queue memory processing (async)                          ││
│  │  5. Return { id, created_at }                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      READ PATH                               ││
│  │                                                              ││
│  │  GET /notes         → list from D1 (paginated)              ││
│  │  GET /notes/:id     → single note from D1                   ││
│  │  DELETE /notes/:id  → soft delete in D1                     ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
┌──────────────────────┐    ┌──────────────────────────────────────┐
│         D1           │    │         MEMORY WORKER                 │
│     (raw log)        │    │      (async processing)               │
│                      │    │                                       │
│  notes               │    │  Triggered by Queue                   │
│  ├── id              │    │                                       │
│  ├── user_id         │    │  For each note:                       │
│  ├── content         │    │  1. Initialize Claude Agent           │
│  ├── source          │    │  2. Provide memory tool               │
│  ├── created_at      │    │  3. Pass note content                 │
│  └── deleted_at      │    │  4. Let Claude decide what to remember│
│                      │    │  5. Store tool call results           │
│  INDEX: (user_id,    │    │                                       │
│          created_at) │    │  Claude writes to /memories           │
└──────────────────────┘    │  We store in KV (per user namespace)  │
                            └──────────────────────────────────────┘
                                              │
                                              ▼
                            ┌──────────────────────────────────────┐
                            │              KV                       │
                            │     (Claude's memory store)          │
                            │                                       │
                            │  Key: {user_id}:/memories/{path}     │
                            │  Value: file content                  │
                            │                                       │
                            │  Claude organizes this.               │
                            │  We just execute the operations.      │
                            └──────────────────────────────────────┘
```

---

## Data Models

### D1: Raw Notes Log

```sql
CREATE TABLE notes (
    id          TEXT PRIMARY KEY,           -- ULID
    user_id     TEXT NOT NULL,              -- tenant isolation
    content     TEXT NOT NULL,              -- the note itself
    source      TEXT DEFAULT 'api',         -- telegram, web, voice, api
    created_at  INTEGER NOT NULL,           -- unix ms
    deleted_at  INTEGER,                    -- soft delete
    
    -- for memory processing tracking
    memory_status   TEXT DEFAULT 'pending', -- pending, processing, done, failed
    memory_error    TEXT                    -- if failed, why
);

CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);
CREATE INDEX idx_notes_memory_status ON notes(memory_status) WHERE memory_status = 'pending';
```

### KV: Claude's Memory Store

```
Key format:  user:{user_id}:memories:{path}
Value:       raw text content

Examples:
  user:123:memories:preferences.md
  user:123:memories:recurring_themes.md  
  user:123:memories:2026/01/summary.md

We don't prescribe structure. Claude decides.
```

### Queue: Memory Processing

```typescript
interface MemoryJob {
    note_id: string;
    user_id: string;
    content: string;
    created_at: number;
}
```

---

## API Endpoints

### Create Note

```
POST /notes
Headers:
  x-user-id: {user_id}
  
Body:
{
    "content": "Today I realized...",
    "source": "telegram"  // optional
}

Response:
{
    "id": "01HQXYZ...",
    "created_at": 1704326400000
}
```

### List Notes

```
GET /notes?limit=50&cursor={created_at}
Headers:
  x-user-id: {user_id}

Response:
{
    "notes": [
        { "id": "...", "content": "...", "source": "...", "created_at": ... },
        ...
    ],
    "cursor": 1704326300000,  // for next page, null if no more
    "count": 50
}
```

### Get Note

```
GET /notes/{id}
Headers:
  x-user-id: {user_id}

Response:
{ "id": "...", "content": "...", "source": "...", "created_at": ... }

404 if not found or belongs to different user
```

### Delete Note

```
DELETE /notes/{id}
Headers:
  x-user-id: {user_id}

Response:
{ "deleted": true }

Sets deleted_at, does not remove row.
```

---

## Memory Processing

The async worker that lets Claude organize memories.

```typescript
// memory-worker.ts

import Anthropic from "@anthropic-ai/sdk";

interface MemoryToolCall {
    command: "view" | "create" | "str_replace" | "insert" | "delete" | "rename";
    path: string;
    // ... other fields based on command
}

export async function processNote(
    note: { id: string; user_id: string; content: string; created_at: number },
    env: Env
): Promise<void> {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    
    const systemPrompt = `You are helping a user maintain a personal diary/notes system.

You have access to a memory tool that lets you organize and store information 
that persists across conversations. Use it however you see fit to help the user 
maintain continuity in their note-taking.

The user has just written a new note. Decide what, if anything, is worth 
remembering long-term. You might:
- Extract key themes or insights
- Note patterns you observe
- Update existing memories with new context
- Create new memory files for significant topics
- Do nothing if the note is routine

Trust your judgment. Organize /memories however makes sense to you.`;

    const userMessage = `New note (${new Date(note.created_at).toISOString()}):

${note.content}`;

    // Create message with memory tool
    const response = await client.beta.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        tools: [{ type: "memory_20250818", name: "memory" }],
        betas: ["context-management-2025-06-27"]
    });

    // Process tool calls
    for (const block of response.content) {
        if (block.type === "tool_use" && block.name === "memory") {
            await executeMemoryOperation(block.input, note.user_id, env);
        }
    }
    
    // Continue conversation if Claude wants more tool calls
    // (implement agentic loop if needed)
}

async function executeMemoryOperation(
    input: MemoryToolCall,
    userId: string,
    env: Env
): Promise<string> {
    const kvKey = (path: string) => `user:${userId}:${path}`;
    
    switch (input.command) {
        case "view": {
            if (input.path === "/memories") {
                // List all memory files for this user
                const list = await env.MEMORIES.list({ prefix: kvKey("memories/") });
                const paths = list.keys.map(k => 
                    k.name.replace(kvKey(""), "")
                );
                return `Directory /memories:\n${paths.join("\n") || "(empty)"}`;
            } else {
                const content = await env.MEMORIES.get(kvKey(input.path.slice(1)));
                return content || "(file not found)";
            }
        }
        
        case "create": {
            await env.MEMORIES.put(
                kvKey(input.path.slice(1)), 
                input.file_text
            );
            return `Created ${input.path}`;
        }
        
        case "str_replace": {
            const content = await env.MEMORIES.get(kvKey(input.path.slice(1)));
            if (!content) return "File not found";
            const newContent = content.replace(input.old_str, input.new_str);
            await env.MEMORIES.put(kvKey(input.path.slice(1)), newContent);
            return `Updated ${input.path}`;
        }
        
        case "delete": {
            await env.MEMORIES.delete(kvKey(input.path.slice(1)));
            return `Deleted ${input.path}`;
        }
        
        case "rename": {
            const content = await env.MEMORIES.get(kvKey(input.old_path.slice(1)));
            if (!content) return "File not found";
            await env.MEMORIES.put(kvKey(input.new_path.slice(1)), content);
            await env.MEMORIES.delete(kvKey(input.old_path.slice(1)));
            return `Renamed ${input.old_path} to ${input.new_path}`;
        }
        
        default:
            return "Unknown command";
    }
}
```

---

## Isolation & Security

### User Isolation

Every database query includes `WHERE user_id = ?`. No exceptions.

```typescript
// CORRECT
const note = await env.DB.prepare(
    'SELECT * FROM notes WHERE id = ? AND user_id = ?'
).bind(id, userId).first();

// NEVER DO THIS
const note = await env.DB.prepare(
    'SELECT * FROM notes WHERE id = ?'
).bind(id).first();
```

KV keys are namespaced by user_id. Claude cannot access another user's memories because the key prefix is constructed server-side from the authenticated user_id.

### Authentication

For MVP, the client (Telegram bot) passes `x-user-id` header. This is trusted because:
- The Worker is not publicly documented
- Telegram bot is the only client
- Bot authenticates users via Telegram's user ID

For production, replace with JWT validation or other auth mechanism.

---

## Cloudflare Resources

```toml
# wrangler.toml

name = "notes-api"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "notes"
database_id = "xxx"

[[kv_namespaces]]
binding = "MEMORIES"
id = "xxx"

[[queues.producers]]
binding = "MEMORY_QUEUE"
queue = "memory-processing"

[[queues.consumers]]
queue = "memory-processing"
max_batch_size = 1
max_retries = 3
```

---

## Migration Path

### To VPS/Self-hosted

1. Replace D1 with SQLite file or Postgres
2. Replace KV with filesystem (`/data/{user_id}/memories/...`)
3. Replace Queue with Redis + Bull or simple cron job
4. Worker becomes Express/Hono server

The code structure stays the same. Only the bindings change.

### To Other Edge Providers

- **Vercel**: D1 → Vercel Postgres, KV → Vercel KV
- **Deno Deploy**: D1 → Deno KV, KV → Deno KV
- **Fly.io**: D1 → SQLite on volume, KV → Redis

---

## What We'll Learn

By running both systems in parallel:

1. **What does Claude remember?**
   - Does it extract themes we'd miss?
   - Does it create useful structure?
   - Does it over-remember or under-remember?

2. **How does it organize?**
   - File structure patterns
   - Naming conventions
   - Update frequency

3. **Does it help retrieval?**
   - When we later build a "companion" feature, which source produces better context?
   - Raw notes with our retrieval, or Claude's curated memories?

4. **Cost/benefit**
   - API calls per note
   - Token usage
   - Latency impact

---

## MVP Scope

### Phase 1: Raw Log Only
- Worker with 4 endpoints
- D1 table
- No memory processing
- Ship in 1 day

### Phase 2: Add Memory Experiment  
- Queue for async processing
- Memory worker
- KV for Claude's memories
- Ship in 2-3 days

### Phase 3: Observe & Learn
- Monitor what Claude remembers
- Build simple viewer for memories
- Compare retrieval quality
- Decide if their vision > ours

---

## Open Questions

1. **Should Claude see previous notes when processing a new one?**
   - Pro: Better context for pattern recognition
   - Con: More tokens, more cost, slower
   - Maybe: Inject last 5-10 notes as context?

2. **Should Claude see its own previous memories?**
   - The memory tool protocol says it checks `/memories` first
   - This is probably correct behavior
   - Let it work as designed

3. **How often should we consolidate/prune memories?**
   - Let Claude decide? 
   - Or periodic cleanup job?
   - Wait and see what accumulates

4. **What prompt produces best memory behavior?**
   - The system prompt above is a starting point
   - Will need iteration based on observed behavior

---

## The Honest Uncertainty

We don't know if this dual approach is clever or overcomplicated.

We don't know if Anthropic's memory tool reflects deep insight or is just a reasonable first attempt.

We don't know if Claude will produce useful memory structures or chaotic noise.

The only way to know is to ship it and watch.

---

*This architecture is an experiment, not a prescription.*
