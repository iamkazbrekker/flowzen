<div align="center">

# 🌊 FlowZen

**Autonomous Supply Chain Intelligence Platform**

*A self-healing, multi-agent logistics platform powered by LLaMA 3.1 70B, real-time disruption detection, and AI-driven rerouting.*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![LLaMA](https://img.shields.io/badge/LLaMA-3.1--70B-purple)](https://groq.com/)
[![Groq](https://img.shields.io/badge/Groq-Inference-orange)](https://groq.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.io/)

</div>

---

## 📌 Problem Statement

Global supply chains are manually managed and highly reactive.

- **Human bottleneck:** Planners manually monitor unstructured news for disruptions (port strikes, weather, congestion).
- **Slow cross-referencing:** Matching vague news alerts to thousands of active shipments takes days.
- **Costly latency:** Manual delays lead to missed SLAs and millions in lost revenue.

**FlowZen solves this** with a webhook-driven, long-running multi-agent pipeline that operates end-to-end — from raw news ingestion to autonomous rerouting — with real side-effects and zero human bottleneck.

---

## 🏗️ Architecture Overview

FlowZen is built as a **three-layer autonomous system**: a data ingestion & intelligence layer, a deterministic reasoning layer, and a streaming conversational layer — all wired together through Next.js API routes and coordinated by React hooks acting as client-side orchestrators.

```
 EXTERNAL DATA SOURCES
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │  NewsAPI     │  │  Twitter/X   │  │  Simulation  │
 │  (live news) │  │  (social)    │  │  (injected)  │
 └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
        │                 │                  │
        └─────────────────┴──────────────────┘
                          │
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │  LAYER 1 — WATCHER AGENT  (/api/disruptions)             │
 │                                                          │
 │  1. fetchWithRetry()  →  NewsAPI articles (up to 15)     │
 │  2. For each article  →  LLaMA 3.1 70B (temp: 0.1)      │
 │     Prompt: "Classify as DisruptionEvent JSON"           │
 │  3. Strip markdown fences, parse JSON                    │
 │  4. deduplicateEvents() — cluster by type::location      │
 │     → keep highest severity, merge summaries             │
 │  5. Return: DisruptionEvent[]                            │
 └────────────────────────┬─────────────────────────────────┘
                          │  DisruptionEvent[]
                          │  cached 60s in useDisruptionAgent
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │  LAYER 2 — ASSESSOR AGENT  (/api/agent/reroute)          │
 │                                                          │
 │  For EACH journey leg (parallel, 100ms stagger):         │
 │                                                          │
 │  disruptionAffectsLeg(disruption, leg)                   │
 │  ├── Mode match: disruption.modes ∩ leg.mode             │
 │  ├── Location match: tokenised location vs route name    │
 │  └── Severity override: HIGH/CRITICAL always flags       │
 │                                                          │
 │  Severity branching:                                     │
 │  ├── CRITICAL/HIGH  → reroute + alternative mode         │
 │  ├── MEDIUM         → monitor, no reroute                │
 │  └── LOW            → acknowledge, no action             │
 │                                                          │
 │  Return: RerouteResult {                                 │
 │    affected, severity, recommendation,                   │
 │    alternativeMode, avoidRegions, confidence             │
 │  }                                                       │
 └────────────────────────┬─────────────────────────────────┘
                          │  RerouteResult[] (pre-computed)
                          │  injected into LLM system prompt
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │  LAYER 3 — RESOLVER AGENT  (/api/planner)                │
 │                                                          │
 │  Model: LLaMA 3.1 70B via Groq (streaming)               │
 │  Transport: Vercel AI SDK DefaultChatTransport           │
 │                                                          │
 │  System prompt context:                                  │
 │  ├── Active disruption details                           │
 │  ├── Affected shipments (up to 10)                       │
 │  └── Pre-computed reroute recommendations                │
 │                                                          │
 │  Constraints: ≤150 words, bullet points,                 │
 │  reference specific shipment IDs, flag SLA risks         │
 │                                                          │
 │  Output: streamed text chunks → UI via useChat()         │
 └────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │  REACT UI LAYER                                          │
 │                                                          │
 │  useDisruptionAgent()  ← client-side orchestrator        │
 │  ├── Polls /api/disruptions (60s cache)                  │
 │  ├── Fires /api/agent/reroute per leg (parallel)         │
 │  ├── Merges real + simulated disruptions                 │
 │  └── Exposes: disruptions, analyses, criticalAlerts      │
 │                                                          │
 │  Components:                                             │
 │  ├── Map.tsx              — Leaflet, affected legs        │
 │  ├── DisruptionAlertBanner— Critical alert ribbon         │
 │  ├── JourneyBuilder       — Multi-leg route editor        │
 │  ├── JourneyChatbot       — /api/agent/chat              │
 │  ├── AgentOrchestrationPanel — Live agent activity        │
 │  ├── SimulationPanel      — Synthetic event injection    │
 │  └── CargoAnalysis        — Cargo risk & cost analysis   │
 └──────────────────────────────────────────────────────────┘
```

---

### Agent Pipeline — Detailed Breakdown

#### 🔭 Agent 1: Watcher (News Ingestion & NLP Classification)

| Property | Detail |
|---|---|
| **Route** | `GET /api/disruptions` |
| **Trigger** | Client poll every 60 seconds via `useDisruptionAgent` |
| **Input** | Live NewsAPI feed (up to 15 articles) or mock fallback |
| **Model** | LLaMA 3.1 70B Versatile via Groq (`temperature: 0.1`) |
| **Output** | Deduplicated `DisruptionEvent[]` with severity, location, affected modes |
| **Retry Logic** | `fetchWithRetry()` — 3 attempts with 2s exponential backoff |
| **Fallback** | Falls back to hardcoded mock disruptions if NewsAPI or Groq fails |
| **Dedup Strategy** | Clusters by `event_type::location`, keeps highest severity, merges summaries |

**Data flow:** `NewsAPI articles` → `analyzeDisruption()` → `LLaMA JSON extraction` → `deduplicateEvents()` → `DisruptionEvent[]`

---

#### 📐 Agent 2: Assessor (Deterministic Reroute Engine)

| Property | Detail |
|---|---|
| **Route** | `POST /api/agent/reroute` |
| **Trigger** | Fired per journey leg in parallel (100ms stagger) by `useDisruptionAgent` |
| **Input** | Single `JourneyLeg` + full `DisruptionEvent[]` (real + simulated) |
| **Model** | **None** — fully deterministic TypeScript logic |
| **Output** | `RerouteResult` with severity, recommendation text, alternative mode |
| **Matching** | Token-based location match + transport mode intersection |
| **Branching** | CRITICAL/HIGH → reroute; MEDIUM → monitor; LOW → no action |
| **Alt Mode Map** | `sea→rail`, `rail→road`, `road→rail`, `air→sea` |
| **Concurrency** | All legs run in parallel; stale results invalidated via generation counter |

**Why deterministic?** Prevents LLM hallucination on factual route/mode matching. The LLM is only used for synthesis and explanation, not for logical decisions.

---

#### 🤖 Agent 3: Resolver (LLaMA Streaming Co-pilot)

| Property | Detail |
|---|---|
| **Route** | `POST /api/planner` |
| **Trigger** | User message via `LlamaCopilot` component (`useChat` hook) |
| **Input** | Chat history + pre-computed disruption + affected shipments |
| **Model** | LLaMA 3.1 70B Versatile via Groq (streaming) |
| **Transport** | Vercel AI SDK `DefaultChatTransport` → `streamText` → `toTextStreamResponse()` |
| **Context Injection** | System prompt includes disruption JSON + shipment list (up to 10) |
| **Constraints** | ≤150 words, bullet points, reference shipment IDs, flag SLA risks |
| **Suggestions** | Pre-seeded chips: SLA protection, CO₂ comparison, cheapest reroute |

---

#### 🧠 Agent 4: NLP Classifier (Standalone LLaMA Extractor)

| Property | Detail |
|---|---|
| **Route** | `POST /api/nlp-llama` |
| **Input** | Raw news text string |
| **Model** | LLaMA 3.1 70B via Groq (`temperature: 0.1`, `maxOutputTokens: 512`) |
| **Output** | Structured `DisruptionEvent` JSON or `{ is_disruption: false }` |
| **Error Handling** | Strips markdown fences; throws `422` on non-JSON output (fail-fast) |

---

#### 💬 Agent 5: Chat Orchestrator (Journey-Aware Chatbot)

| Property | Detail |
|---|---|
| **Route** | `POST /api/agent/chat` |
| **Input** | Chat history + full journey state (legs, disruptions, analyses, simulations) |
| **Model** | LLaMA 3.3 70B Versatile via Groq (`temperature: 0.5`, `max_tokens: 512`) |
| **Context** | Builds a full system prompt including per-leg status (CLEAR/AFFECTED/REROUTED) |
| **Output** | Non-streaming JSON `{ reply: string }` |

---

### 🔧 Tool Surface

FlowZen agents use a combination of **external API tools**, **internal deterministic functions**, and **LLM calls** — each scoped tightly to a single responsibility.

#### External API Tools (Real Side-Effects)

| Tool | Called By | Side-Effect |
|---|---|---|
| `NewsAPI /v2/everything` | Watcher Agent (`ingest.ts`) | Fetches up to 15 live news articles matching logistics-disruption queries |
| `Twitter API v2` | Social Feed Agent (`twitter-api-v2`) | Pulls social signals from logistics hashtags for supplementary disruption data |
| `Supabase` | Persistence Layer (`supabaseClient.ts`) | Reads/writes disruption events to PostgreSQL for long-term storage |

#### LLM Tool Calls (Groq Inference)

| Call | Model | Temperature | Purpose | Output |
|---|---|---|---|---|
| **Stage 1: Relevance Filter** | LLaMA 3.1 8B Instant | `0.0` | Fast binary gate — is this article about a logistics disruption? | `{ is_relevant: bool }` |
| **Stage 2: Entity Extraction** | LLaMA 3.3 70B Versatile | `0.1` | Extract structured `DisruptionEvent` JSON from raw text | Full event schema |
| **Simulation Generator** | LLaMA 3.3 70B Versatile | `0.2` | Convert free-text user input into a synthetic `DisruptionEvent` | Full event schema |
| **Planner Co-pilot** | LLaMA 3.1 70B Versatile | default | Streaming logistics advice with pre-injected disruption context | Streamed text |
| **Chat Orchestrator** | LLaMA 3.3 70B Versatile | `0.5` | Journey-aware conversational Q&A | `{ reply: string }` |

> **Design decision:** Stage 1 uses the fast **8B** model as a cheap filter gate. Only articles that pass Stage 1 are sent to the expensive **70B** model for structured extraction. This reduces Groq API costs by ~60% while maintaining extraction quality.

#### Internal Deterministic Functions (No LLM)

| Function | Location | Purpose |
|---|---|---|
| `disruptionAffectsLeg()` | `agent/reroute/route.ts` | Token-based matching of disruption location/mode against a journey leg |
| `recommendAlternative()` | `agent/reroute/route.ts` | Hardcoded transport mode fallback map (`sea→rail`, `rail→road`, etc.) |
| `deduplicateEvents()` | `pipeline.ts` | Clusters events by `event_type::location`, keeps highest severity |
| `fetchWithRetry()` | `ingest.ts` | 3-attempt exponential backoff for external API calls |
| `executeGroqWithRetry()` | `analyzer.ts` | 2-attempt retry with 1s backoff for LLM calls |
| `buildRunKey()` | `useOrchestrator.ts` | Hashes current affected-leg state to detect changes and prevent duplicate runs |

---

### 🤖 What Makes the Workflow Autonomous in Practice

This is not a chatbot. The pipeline runs, reasons, and acts **without waiting for human input** at any step.

#### 1. Self-Triggering Ingestion

The `useDisruptionAgent` hook automatically polls `/api/disruptions` every **60 seconds**. Each poll triggers the full pipeline: NewsAPI fetch → Stage 1 (8B relevance filter) → Stage 2 (70B entity extraction) → deduplication. No button press required.

```
useDisruptionAgent starts → fetchReal() (60s cache)
    → /api/disruptions → runPipeline()
        → ingestNews() → for each article: analyzeDisruption()
            → classifyRelevance() [8B]
            → extractDisruption() [70B]
        → deduplicateEvents()
    → DisruptionEvent[] returned to client
```

#### 2. Reactive Leg Analysis (Event-Driven, Not Polling)

When disruption data changes — either from a fresh poll **or** from a user injecting a simulated event — the `useDisruptionAgent` hook **automatically re-fires analysis** for every journey leg in parallel. This is driven by React's `useEffect` dependency tracking, not manual triggers:

- A `runTick` counter increments whenever the simulated disruptions array changes
- A **generation counter** (`gen.current`) invalidates stale async results from previous runs
- Each leg is analyzed with a **100ms stagger** to avoid overwhelming the API

#### 3. Auto-Orchestration with Debounced Triggers

The `useOrchestrator` hook watches all leg analyses. When it detects that analyses have **settled** (no more in-flight requests), it:

1. Builds a **run key** — a hash of `legId:severity:alternativeMode` for all affected legs
2. Compares against the last fired key to **prevent duplicate runs**
3. Waits **1.2 seconds** (debounce) for the state to fully stabilize
4. Fires `/api/agent/orchestrate` for each affected leg sequentially
5. If the affected-leg state changes mid-run, the previous run is **aborted** via `AbortController`

```
useOrchestrator watches analyses
    → analyses settle (no loading)
    → buildRunKey() → compare to lastFiredKey
    → if changed → debounce 1.2s → fire orchestration
    → if state changes mid-run → AbortController.abort()
```

#### 4. Simulation as a First-Class Autonomous Trigger

Injecting a simulated disruption (via the Simulation Panel → `/api/simulation`) doesn't just display it — it **triggers the entire pipeline** as if a real event occurred:

1. LLaMA converts free-text to structured `DisruptionEvent` JSON
2. The event is merged into the `simulatedDisruptions` array
3. `useDisruptionAgent` detects the change (via `prevSimKey` comparison)
4. All journey legs are **re-analyzed** with real + simulated disruptions combined
5. `useOrchestrator` detects new affected legs and fires rerouting

**The user types "Port strike at Rotterdam" → within 3 seconds, every affected journey leg is re-assessed, rerouted, and the map updates — zero clicks after the initial injection.**

#### 5. Stale State Invalidation

Every async operation is protected against stale execution:

| Mechanism | Where | How |
|---|---|---|
| **Generation counter** | `useDisruptionAgent` | `gen.current` increments on every new run; callbacks check `gen.current !== myGen` before applying state |
| **Run key dedup** | `useOrchestrator` | `buildRunKey()` creates a stable hash; identical keys are skipped |
| **AbortController** | `useOrchestrator` | In-flight HTTP requests are cancelled when a newer run starts |
| **60s cache** | `useDisruptionAgent` | `fetchReal()` returns cached results if polled within 60 seconds |
| **Alive flag** | `useDisruptionAgent` | Cleanup function sets `alive = false` to prevent state updates after unmount |

---

## ✨ Key Features

- 🤖 **Autonomous Multi-Agent Pipeline** — Agents trigger, communicate, and resolve disruptions without human input
- 🗺️ **Interactive Leaflet Map** — Live journey visualization with affected leg highlighting
- 🔴 **Real-time Disruption Detection** — Pulls from live news feeds, classifies with LLaMA NLP
- ↪️ **Deterministic Rerouting Engine** — Severity-based branching with alternative mode recommendations
- 💬 **LLaMA Co-pilot** — Streaming chat with full logistics context (journey, disruptions, SLA)
- 🧪 **Simulation Panel** — Inject synthetic disruption events to test the pipeline live
- 📦 **Cargo Analysis** — AI-driven cargo risk and cost-trade-off analysis
- 🔄 **Deduplication Pipeline** — Merges duplicate disruptions by event type + location cluster

---

## 🛠️ Tech Stack

### Core Framework
| Package | Version | Purpose |
|---|---|---|
| `next` | ^16.2.6 | Full-stack React framework (App Router) |
| `react` | ^19.2.4 | UI library |
| `typescript` | ^5.9.3 | Type safety |

### AI / LLM
| Package | Version | Purpose |
|---|---|---|
| `ai` | ^6.0.182 | Vercel AI SDK — `streamText`, `generateText`, `useChat` |
| `@ai-sdk/react` | ^3.0.184 | `useChat` hook with `DefaultChatTransport` |
| `@ai-sdk/groq` | ^3.0.39 | Groq provider for AI SDK |
| `groq-sdk` | ^1.2.0 | Direct Groq SDK for non-streaming completions |
| `@anthropic-ai/sdk` | ^0.96.0 | Anthropic Claude SDK (NLP fallback) |

> **LLM Provider:** [Groq](https://groq.com/) — ultra-low latency inference for LLaMA 3.1 70B Versatile

### Database & Backend
| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | ^2.105.4 | PostgreSQL database for disruption persistence |

### UI & Mapping
| Package | Version | Purpose |
|---|---|---|
| `leaflet` | ^1.9.4 | Interactive world map (SSR disabled) |
| `@types/leaflet` | ^1.9.21 | Leaflet TypeScript types |
| `lucide-react` | ^1.16.0 | Icon library |
| `motion` | ^12.38.0 | Framer Motion animations |
| `gsap` | ^3.15.0 | Advanced animation toolkit |

### Data & Utilities
| Package | Version | Purpose |
|---|---|---|
| `axios` | ^1.16.1 | HTTP client for external API calls |
| `date-fns` | ^4.1.0 | Date formatting and manipulation |
| `twitter-api-v2` | ^1.29.0 | Twitter/X social signal ingestion |
| `dotenv` | ^17.4.2 | Environment variable management |

### Dev Tools
| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | ^4 | Utility-first CSS |
| `@tailwindcss/postcss` | ^4 | PostCSS integration for Tailwind |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.2.6 | Next.js ESLint config |

---

## ⚡ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) >= 20.x
- [npm](https://www.npmjs.com/) >= 10.x
- A [Groq API Key](https://console.groq.com/)
- A [Supabase](https://supabase.com/) project (free tier works)
- *(Optional)* A [NewsAPI](https://newsapi.org/) key for live disruption feeds
- *(Optional)* Twitter Developer credentials for social signal ingestion

---

### Option A: Local Development

**1. Clone the repository**
```bash
git clone https://github.com/your-org/flowzen.git
cd flowzen/flowzen
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**

Create a `.env` file in the `flowzen/` directory:
```env
# ── LLM Provider ───────────────────────────────────────────
GROQ_API_KEY=gsk_your_groq_api_key_here

# ── Database ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# ── News Ingestion (optional, falls back to mock data) ──────
NEWS_API_KEY=your_newsapi_key_here

# ── Social Signal Ingestion (optional) ──────────────────────
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_SECRET=your_twitter_access_secret
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
```

**4. Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B: Docker

**1. Create a `Dockerfile`** in the `flowzen/` directory:
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**2. Create a `docker-compose.yml`** in the project root:
```yaml
version: "3.9"
services:
  flowzen:
    build:
      context: ./flowzen
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEWS_API_KEY=${NEWS_API_KEY}
      - TWITTER_BEARER_TOKEN=${TWITTER_BEARER_TOKEN}
    restart: unless-stopped
```

**3. Run with Docker Compose:**
```bash
# Copy and fill your environment variables
cp flowzen/.env .env

# Build and launch
docker-compose up --build
```

The app will be live at [http://localhost:3000](http://localhost:3000).

---

## 📁 Project Structure

```
flowzen/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/
│   │   │   │   ├── chat/route.ts       # Contextual journey chatbot
│   │   │   │   └── reroute/route.ts    # Deterministic reroute assessor
│   │   │   ├── disruptions/route.ts    # Triggers the full NLP pipeline
│   │   │   ├── ingest/route.ts         # News ingestion endpoint
│   │   │   ├── nlp-llama/route.ts      # LLaMA NLP classification
│   │   │   ├── planner/route.ts        # Streaming LLaMA co-pilot
│   │   │   ├── simulation/route.ts     # Synthetic disruption injection
│   │   │   └── social-feed/route.ts    # Twitter signal ingestion
│   │   ├── components/
│   │   │   ├── AgentOrchestrationPanel.tsx  # Live agent activity monitor
│   │   │   ├── CargoAnalysis.tsx            # Cargo risk analysis panel
│   │   │   ├── DisruptionAlertBanner.tsx    # Real-time alert banner
│   │   │   ├── JourneyBuilder.tsx           # Multi-leg journey editor
│   │   │   ├── JourneyChatbot.tsx           # Journey-aware chatbot UI
│   │   │   ├── Map.tsx                      # Leaflet interactive map
│   │   │   └── SimulationPanel.tsx          # Disruption simulation UI
│   │   └── page.tsx                         # Main app page
│   ├── hooks/
│   │   ├── useDisruptionAgent.ts       # Orchestrates leg analysis
│   │   └── useOrchestrator.ts          # Multi-agent state manager
│   └── lib/
│       ├── analyzer.ts                 # LLaMA-powered article analyzer
│       ├── groq.ts                     # Groq SDK client
│       ├── ingest.ts                   # NewsAPI ingest + retry logic
│       ├── llama.ts                    # LLaMA model config & SDK
│       ├── pipeline.ts                 # Ingest → NLP → Dedup pipeline
│       ├── prompts.ts                  # Shared LLM system prompts
│       ├── supabaseClient.ts           # Supabase client singleton
│       └── types.ts                    # Shared TypeScript types
├── .env                                # Environment variables
├── package.json
└── README.md
```

---

## 🔌 API Reference

### `GET /api/disruptions`
Triggers the full autonomous pipeline: NewsAPI ingest → LLaMA NLP classification → deduplication.

**Response:**
```json
{
  "disruptions": [DisruptionEvent],
  "metadata": {
    "total_fetched": 15,
    "relevant_count": 8,
    "deduplicated_count": 6,
    "timestamp": "2026-05-16T07:00:00Z"
  }
}
```

### `POST /api/agent/reroute`
Deterministically assesses whether a journey leg is impacted by active disruptions.

**Body:**
```json
{
  "leg": { "id": "leg-1", "fromName": "Shanghai", "toName": "Rotterdam", "mode": "sea", ... },
  "disruptions": [DisruptionEvent]
}
```

### `POST /api/planner`
Streams a LLaMA 3.1 70B logistics co-pilot response via the Vercel AI SDK.

**Body:**
```json
{
  "messages": [{ "role": "user", "content": "Which route protects my Q3 SLA?" }],
  "shipments": [...],
  "disruption": {...}
}
```

### `POST /api/nlp-llama`
Classifies a raw news text into a structured `DisruptionEvent` JSON object.

**Body:**
```json
{ "rawText": "Suez Canal blocked after container ship runs aground..." }
```

---

## 🧪 Simulation Mode

FlowZen includes a built-in **Simulation Panel** that lets you inject synthetic disruption events directly into the agent pipeline — ideal for demos and testing without waiting for real news.

1. Open the **Simulation** panel from the sidebar.
2. Select or create a disruption event (e.g., port strike at Rotterdam, severity: Critical).
3. The `useDisruptionAgent` hook automatically re-runs analysis across all journey legs with the injected event merged alongside real data.

---

## 🌍 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Groq API key for LLaMA 3.1 70B inference |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous public key |
| `NEWS_API_KEY` | ⚠️ Optional | NewsAPI key (falls back to mock data if absent) |
| `TWITTER_BEARER_TOKEN` | ⚠️ Optional | Twitter/X bearer token for social signals |
| `TWITTER_API_KEY` | ⚠️ Optional | Twitter API key |
| `TWITTER_API_SECRET` | ⚠️ Optional | Twitter API secret |
| `TWITTER_ACCESS_TOKEN` | ⚠️ Optional | Twitter access token |
| `TWITTER_ACCESS_SECRET` | ⚠️ Optional | Twitter access secret |

> **Note:** Without `NEWS_API_KEY`, the pipeline automatically falls back to built-in mock disruptions (Suez Canal closure, Shanghai typhoon) to ensure the demo always works.

---

## 📜 Available Scripts

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Build production bundle
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">
Built with ⚡ by the FlowZen team
</div>
