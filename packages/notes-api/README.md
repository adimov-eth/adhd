# Notes API

A simple note-taking service with an experimental dual-memory architecture.

Every note is stored twice:
1. **Raw log** — Append-only D1 database. Your source of truth.
2. **Claude's memory** — Whatever Claude decides to remember via Anthropic's memory tool.

## Why?

We don't know if Anthropic's memory tool produces better AI continuity than structured retrieval we'd design ourselves. This is an experiment to find out.

## Setup

```bash
# Install dependencies
npm install

# Create Cloudflare resources
npm run db:create
npm run kv:create  
npm run queue:create

# Update wrangler.toml with the IDs printed above

# Run database migrations
npm run db:migrate

# Set your Anthropic API key
npm run secret:set
# (paste your key when prompted)

# Deploy
npm run deploy
```

## Local Development

```bash
# Run migrations locally
npm run db:migrate:local

# Start dev server
npm run dev
```

## API

### Create Note
```bash
curl -X POST https://your-worker.workers.dev/notes \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{"content": "Today I learned...", "source": "telegram"}'
```

### List Notes
```bash
curl https://your-worker.workers.dev/notes \
  -H "x-user-id: user123"
```

### Get Note
```bash
curl https://your-worker.workers.dev/notes/{id} \
  -H "x-user-id: user123"
```

### Delete Note
```bash
curl -X DELETE https://your-worker.workers.dev/notes/{id} \
  -H "x-user-id: user123"
```

## Architecture

```
POST /notes
    │
    ├──→ D1 (raw log)
    │
    └──→ Queue ──→ Memory Worker ──→ Claude API ──→ KV (memories)
```

See `notes-service-architecture.md` for full details.

## What We're Learning

- What does Claude choose to remember?
- How does it organize `/memories`?
- Does its structure produce better context than raw retrieval?

Watch the KV namespace to see Claude's memory evolve.
