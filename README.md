# ADHD

Research and implementation for a voice-first ADHD support system.

## Repository Structure

```
├── docs/                    # Research & documentation (Obsidian vault)
│   ├── Artifacts/           # Synthesized findings
│   ├── Clippings/           # Reference materials
│   └── *.md                 # Research documents
├── packages/
│   └── notes-api/           # Cloudflare Worker - Notes with AI memory
└── .obsidian/               # Obsidian configuration
```

---

## Packages

| Package | Description | Stack |
|---------|-------------|-------|
| [notes-api](packages/notes-api/) | Notes service with dual-memory architecture | Cloudflare Workers, D1, KV, Hono |

---

## Research Documents

### Core Research

| Document | Description |
|----------|-------------|
| [Research 1](docs/Research%201.md) | Therapy techniques, AI companion ethics, "ambient exocortex" vision |
| [Research 2](docs/Research%202.md) | CBT protocols, app retention, Headspace's fading scaffold |
| [Research 3](docs/Research%203.md) | AI memory systems, resonance memory, therapeutic companions |
| [Memory Systems](docs/Bonus%20research%20-%20memory%20systems.md) | Self-evolving agents and memory architecture analysis |

### Synthesized Artifacts

| Document | Key Insight |
|----------|-------------|
| [What Helps ADHD](docs/Artifacts/What%20Helps%20ADHD.md) | External scaffolding works; cognitive training doesn't transfer |
| [Few Apps Have Evidence](docs/Artifacts/Few%20ADHD%20apps%20have%20real%20scientific%20evidence.md) | Only 3 FDA-cleared apps; lab gains ≠ real-world benefits |
| [Voice-first AI](docs/Artifacts/Voice-first%20AI%20for%20ADHD.md) | Voice reduces load 275%; never punish inconsistency |
| [Building the App](docs/Artifacts/Building%20a%20self-sustaining%20ADHD.md) | Solo founder roadmap, ~2K subs at $50/yr for sustainability |

### Reference Materials

| Document | Source |
|----------|--------|
| [Circadian & ADHD](docs/Clippings/ADHD%20as%20a%20circadian%20rhythm%20disorder%20evidence%20and%20implications%20for%20chronotherapy.md) | Frontiers in Psychiatry (2025) |
| [Chronobiology](docs/Clippings/The%20Chronobiology%20of%20Human%20Health.md) | Circadian mechanisms deep dive |
| [ADHD Training Notes](docs/Clippings/ADHD%20training%20notes.md) | Safren-based skills program notes |
| [Circadian Correction](docs/How%20to%20work%20with%20Cycles%20(gemini%20research).md) | Practical DLMO, light therapy, melatonin protocols |

---

## Core Insight

**Effective ADHD interventions provide external scaffolding rather than trying to "fix" internal cognitive deficits.**

What works:
- External systems (calendars, visual timers, reminders)
- Body doubling (presence without surveillance)
- Safren's CBT model (d = 1.74-1.97)
- Implementation intentions ("if-then" plans)
- Circadian interventions (morning light, melatonin timing)

What fails:
- Cognitive/working memory training (no transfer)
- Streak mechanics (shame spirals)
- Apps that punish inconsistency

---

## Development

```bash
# Notes API
cd packages/notes-api
npm install
npm run dev
```

See [packages/notes-api/README.md](packages/notes-api/README.md) for setup details.
