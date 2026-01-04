# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a **monorepo** that doubles as an **Obsidian vault**:

```
├── docs/                    # Research documents (Obsidian-compatible)
│   ├── Artifacts/           # Synthesized findings and product vision
│   ├── Clippings/           # Reference materials
│   └── *.md                 # Primary research
├── packages/
│   └── notes-api/           # Cloudflare Worker implementation
└── .obsidian/               # Obsidian configuration
```

## Packages

### notes-api

A Cloudflare Worker implementing a Notes API with dual-memory architecture:
- **D1**: Append-only raw log (source of truth)
- **KV**: Claude's memory store (experimental)

**Stack**: Hono, Cloudflare Workers, D1, KV, Queues

**Commands**:
```bash
cd packages/notes-api
npm install
npm run dev              # Local development
npm run deploy           # Deploy to Cloudflare
npm run db:migrate       # Run D1 migrations
npm run db:migrate:local # Run migrations locally
```

**Key files**:
- `src/worker.ts` — Main worker with API routes and queue consumer
- `schema.sql` — D1 database schema
- `ARCHITECTURE.md` — Detailed system design

## Research Context

The central insight driving this project:

**Effective ADHD interventions provide external scaffolding rather than trying to "fix" internal cognitive deficits.**

The notes-api is an experiment to test whether Anthropic's memory tool produces better AI continuity than structured retrieval we'd design ourselves.

## Working with This Repo

**When modifying code**:
- The worker uses Hono for routing
- All DB queries must include `user_id` for tenant isolation
- Memory operations are processed async via Cloudflare Queues

**When expanding research**:
- Maintain evidence-based approach with citations
- Focus on practical implications for app design
- Preserve the core insight about external scaffolding

**Obsidian compatibility**:
- Keep markdown files in `docs/` for vault navigation
- Use standard markdown links (Obsidian handles them)
