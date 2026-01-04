// src/worker.ts
// Notes API - Cloudflare Worker

import { Hono } from "hono";
import { cors } from "hono/cors";

// ULID generation (simplified, no external deps)
function generateUlid(): string {
  const timestamp = Date.now().toString(36).padStart(10, "0");
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");
  return (timestamp + random).toUpperCase();
}

// Types
interface Env {
  DB: D1Database;
  MEMORIES?: KVNamespace;
  MEMORY_QUEUE?: Queue<MemoryJob>;
  ANTHROPIC_API_KEY?: string;
}

interface Note {
  id: string;
  user_id: string;
  content: string;
  source: string;
  created_at: number;
  deleted_at: number | null;
  memory_status: string;
}

interface MemoryJob {
  note_id: string;
  user_id: string;
  content: string;
  created_at: number;
}

// App
const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// Middleware
app.use("/*", cors());

// Health check - no auth required
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

// Auth middleware for /notes routes
app.use("/notes/*", async (c, next) => {
  const userId = c.req.header("x-user-id");

  if (!userId) {
    return c.json({ error: "missing x-user-id header" }, 401);
  }

  c.set("userId", userId);
  await next();
});

app.use("/notes", async (c, next) => {
  const userId = c.req.header("x-user-id");

  if (!userId) {
    return c.json({ error: "missing x-user-id header" }, 401);
  }

  c.set("userId", userId);
  await next();
});

// Routes

// Create note
app.post("/notes", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ content: string; source?: string }>();

  if (!body.content || typeof body.content !== "string") {
    return c.json({ error: "content is required" }, 400);
  }

  const id = generateUlid();
  const created_at = Date.now();
  const source = body.source || "api";

  // Determine initial memory status based on whether memory processing is available
  const hasMemoryProcessing = c.env.MEMORIES && c.env.ANTHROPIC_API_KEY;
  const memory_status = hasMemoryProcessing ? "pending" : "skipped";

  await c.env.DB.prepare(
    `INSERT INTO notes (id, user_id, content, source, created_at, memory_status)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, body.content, source, created_at, memory_status)
    .run();

  // Queue for async memory processing if available
  if (c.env.MEMORY_QUEUE) {
    await c.env.MEMORY_QUEUE.send({
      note_id: id,
      user_id: userId,
      content: body.content,
      created_at,
    });
  } else if (hasMemoryProcessing) {
    // No queue available - process synchronously via waitUntil
    // This runs after response is sent, within worker lifetime
    const ctx = c.executionCtx;
    ctx.waitUntil(
      processNoteMemory(
        { note_id: id, user_id: userId, content: body.content, created_at },
        c.env as Env & { MEMORIES: KVNamespace; ANTHROPIC_API_KEY: string }
      ).then(async () => {
        await c.env.DB.prepare(
          `UPDATE notes SET memory_status = 'done' WHERE id = ?`
        )
          .bind(id)
          .run();
      }).catch(async (error) => {
        console.error(`Memory processing failed for note ${id}:`, error);
        await c.env.DB.prepare(
          `UPDATE notes SET memory_status = 'failed', memory_error = ? WHERE id = ?`
        )
          .bind(error instanceof Error ? error.message : "unknown error", id)
          .run();
      })
    );
  }

  return c.json({ id, created_at }, 201);
});

// List notes
app.get("/notes", async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const cursor = c.req.query("cursor");

  let query = `
    SELECT id, content, source, created_at
    FROM notes
    WHERE user_id = ? AND deleted_at IS NULL
  `;
  const params: (string | number)[] = [userId];

  if (cursor) {
    query += ` AND created_at < ?`;
    params.push(parseInt(cursor));
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit + 1); // fetch one extra to detect hasMore

  const result = await c.env.DB.prepare(query)
    .bind(...params)
    .all<Note>();

  const notes = result.results?.slice(0, limit) || [];
  const hasMore = (result.results?.length || 0) > limit;

  return c.json({
    notes,
    cursor: hasMore && notes.length > 0
      ? notes[notes.length - 1].created_at.toString()
      : null,
    count: notes.length,
  });
});

// Get single note
app.get("/notes/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const note = await c.env.DB.prepare(
    `SELECT id, content, source, created_at
     FROM notes
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
  )
    .bind(id, userId)
    .first<Note>();

  if (!note) {
    return c.json({ error: "not found" }, 404);
  }

  return c.json(note);
});

// Delete note (soft delete)
app.delete("/notes/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const result = await c.env.DB.prepare(
    `UPDATE notes SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
  )
    .bind(Date.now(), id, userId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "not found or already deleted" }, 404);
  }

  return c.json({ deleted: true });
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Queue consumer for memory processing (if queues are available)
  async queue(batch: MessageBatch<MemoryJob>, env: Env): Promise<void> {
    if (!env.MEMORIES || !env.ANTHROPIC_API_KEY) {
      console.warn("Memory processing not configured, skipping queue messages");
      for (const message of batch.messages) {
        message.ack();
      }
      return;
    }

    for (const message of batch.messages) {
      const job = message.body;

      try {
        await processNoteMemory(job, env as Env & { MEMORIES: KVNamespace; ANTHROPIC_API_KEY: string });

        // Mark as done
        await env.DB.prepare(
          `UPDATE notes SET memory_status = 'done' WHERE id = ?`
        )
          .bind(job.note_id)
          .run();

        message.ack();
      } catch (error) {
        console.error(`Memory processing failed for note ${job.note_id}:`, error);

        // Mark as failed
        await env.DB.prepare(
          `UPDATE notes SET memory_status = 'failed', memory_error = ? WHERE id = ?`
        )
          .bind(error instanceof Error ? error.message : "unknown error", job.note_id)
          .run();

        message.retry();
      }
    }
  },
};

// Memory processing with Claude API
async function processNoteMemory(
  job: MemoryJob,
  env: { MEMORIES: KVNamespace; ANTHROPIC_API_KEY: string; DB: D1Database }
): Promise<void> {
  const systemPrompt = `You are helping a user maintain a personal diary/notes system.

You have access to a memory tool that lets you organize and store information
that persists across conversations. Use it however you see fit.

The user has just written a new note. Decide what, if anything, is worth
remembering long-term. You might:
- Extract key themes or insights
- Note patterns you observe
- Update existing memories with new context
- Create new memory files for significant topics
- Do nothing if the note is routine

Trust your judgment. Organize /memories however makes sense to you.
Keep memories concise and useful for future context.`;

  const userMessage = `New note (${new Date(job.created_at).toISOString()}):

${job.content}`;

  // Call Anthropic API with memory tool
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "context-management-2025-06-27",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [{ type: "memory_20250818", name: "memory" }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const result = await response.json() as {
    content: Array<{ type: string; name?: string; input?: any; id?: string }>;
    stop_reason: string;
  };

  // Process tool calls in a loop until done
  let messages: any[] = [{ role: "user", content: userMessage }];
  let currentResult = result;

  while (currentResult.stop_reason === "tool_use") {
    const assistantContent = currentResult.content;
    messages.push({ role: "assistant", content: assistantContent });

    const toolResults: any[] = [];

    for (const block of assistantContent) {
      if (block.type === "tool_use" && block.name === "memory") {
        const output = await executeMemoryOperation(
          block.input,
          job.user_id,
          env
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: output,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    // Continue the conversation
    const continueResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "context-management-2025-06-27",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: [{ type: "memory_20250818", name: "memory" }],
      }),
    });

    if (!continueResponse.ok) {
      throw new Error(`Anthropic API error: ${continueResponse.status}`);
    }

    currentResult = await continueResponse.json();
  }
}

// Execute memory tool operations against KV
async function executeMemoryOperation(
  input: {
    command: string;
    path?: string;
    file_text?: string;
    old_str?: string;
    new_str?: string;
    old_path?: string;
    new_path?: string;
    view_range?: [number, number];
    insert_line?: number;
    insert_text?: string;
  },
  userId: string,
  env: { MEMORIES: KVNamespace }
): Promise<string> {
  const kvKey = (path: string) => {
    // Remove leading slash and prefix with user namespace
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `user:${userId}:${cleanPath}`;
  };

  switch (input.command) {
    case "view": {
      if (!input.path) {
        return "Error: path is required";
      }

      if (input.path === "/memories" || input.path === "/memories/") {
        // List directory
        const prefix = kvKey("memories/");
        const list = await env.MEMORIES.list({ prefix });

        if (list.keys.length === 0) {
          return "Directory /memories:\n(empty)";
        }

        const paths = list.keys.map((k) => {
          const relativePath = k.name.replace(`user:${userId}:`, "/");
          return `- ${relativePath}`;
        });

        return `Directory /memories:\n${paths.join("\n")}`;
      } else {
        // Read file
        const content = await env.MEMORIES.get(kvKey(input.path));
        if (!content) {
          return `Error: File not found: ${input.path}`;
        }

        // Handle view_range if provided
        if (input.view_range) {
          const lines = content.split("\n");
          const [start, end] = input.view_range;
          const slice = lines.slice(start - 1, end === -1 ? undefined : end);
          return slice
            .map((line, i) => `${start + i}: ${line}`)
            .join("\n");
        }

        return content;
      }
    }

    case "create": {
      if (!input.path || input.file_text === undefined) {
        return "Error: path and file_text are required";
      }
      await env.MEMORIES.put(kvKey(input.path), input.file_text);
      return `Created: ${input.path}`;
    }

    case "str_replace": {
      if (!input.path || !input.old_str) {
        return "Error: path and old_str are required";
      }
      const content = await env.MEMORIES.get(kvKey(input.path));
      if (!content) {
        return `Error: File not found: ${input.path}`;
      }
      if (!content.includes(input.old_str)) {
        return `Error: old_str not found in file`;
      }
      const newContent = content.replace(input.old_str, input.new_str || "");
      await env.MEMORIES.put(kvKey(input.path), newContent);
      return `Updated: ${input.path}`;
    }

    case "insert": {
      if (!input.path || input.insert_line === undefined || !input.insert_text) {
        return "Error: path, insert_line, and insert_text are required";
      }
      const content = await env.MEMORIES.get(kvKey(input.path));
      if (!content) {
        return `Error: File not found: ${input.path}`;
      }
      const lines = content.split("\n");
      lines.splice(input.insert_line - 1, 0, input.insert_text);
      await env.MEMORIES.put(kvKey(input.path), lines.join("\n"));
      return `Inserted at line ${input.insert_line}: ${input.path}`;
    }

    case "delete": {
      if (!input.path) {
        return "Error: path is required";
      }
      await env.MEMORIES.delete(kvKey(input.path));
      return `Deleted: ${input.path}`;
    }

    case "rename": {
      if (!input.old_path || !input.new_path) {
        return "Error: old_path and new_path are required";
      }
      const content = await env.MEMORIES.get(kvKey(input.old_path));
      if (!content) {
        return `Error: File not found: ${input.old_path}`;
      }
      await env.MEMORIES.put(kvKey(input.new_path), content);
      await env.MEMORIES.delete(kvKey(input.old_path));
      return `Renamed: ${input.old_path} -> ${input.new_path}`;
    }

    default:
      return `Error: Unknown command: ${input.command}`;
  }
}
