# Chat Friction Tagger

Chat Friction Tagger helps e-commerce sales and support teams analyze conversational commerce transcripts (WhatsApp, Instagram, web chat) to identify what is blocking each sale and draft policy-safe replies for human review.

Every tag and reply comes from a live server-side LLM call—there is no demo mode, no preloaded sample data, and no keyword-rule fallback.

## Folder Structure

```text
.
├── client/
│   └── src/
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── InputPanel.tsx
│       │   ├── ResultsTable.tsx
│       │   ├── StoreFactsDrawer.tsx
│       │   └── SummarySection.tsx
│       ├── utils/
│       │   ├── chatParser.ts
│       │   ├── concurrency.ts
│       │   └── storage.ts
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       └── types.ts
├── server/
│   ├── app.js          # Express router (/api/analyze, /api/health)
│   ├── index.js        # Standalone Express entrypoint (port 3001)
│   ├── llmClient.js    # Single-function LLM provider module: analyzeChat(chat)
│   ├── rateLimit.js    # In-memory sliding-window rate limiter
│   └── validation.js   # Zod schema, fence stripping, verbatim evidence verification
├── server.ts           # Full-stack entrypoint (port 3000 with Vite middleware / dist)
├── index.html
├── package.json
├── vite.config.ts
└── .env.example
```

## Setup Steps

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add your API key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```env
   LLM_PROVIDER="groq"
   LLM_MODEL="openai/gpt-oss-120b"
   LLM_API_KEY="your_api_key_here"
   ```

   (`LLM_PROVIDER="gemini"` with `LLM_MODEL="gemini-4-hydrogen"` is also supported.)

3. Start the development server:

   ```bash
   npm run dev
   ```

   This runs the Express API and Vite frontend together on `http://localhost:3000`.
   If you prefer running the standalone backend and Vite dev proxy separately:

   ```bash
   npm run dev:server   # Express API on http://localhost:3001
   npm run dev:client   # Vite on http://localhost:3000 proxying /api -> 3001
   ```

4. Build for production:

   ```bash
   npm run build
   npm start
   ```

## Fictional Example Chats (For Testing)

Paste these into the app with a blank line between each conversation to test different friction categories:

```text
Customer: Hi, do you still have the linen overshirt in olive, size M?
Agent: Let me check for you. Looks like olive M sold out yesterday, we only have L left.
Customer: Ah okay, L will be too big. Thanks anyway.

Customer: Hey! I tried checking out with my Visa debit card twice and it keeps saying payment declined even though my balance is fine.
Customer: Is there another way I can pay or a payment link?

Customer: Love the ceramic pour-over set! How much is shipping to Austin and how long does it take? Also $68 feels a bit steep if shipping is extra.
```

## Limitations

- **Interpretation, not proof**: Tags and evidence reflect the LLM's reading of conversation wording, not causal proof of why a customer abandoned a purchase.
- **Verbatim evidence check**: The backend checks whether the returned `evidence` substring appears in the original chat. If a model paraphrases instead of quoting verbatim, the row is flagged as `Evidence not found in original chat` for manual inspection.
- **No external catalog or order lookup**: The analyzer has access only to the pasted chat text and the optional Store Policy Facts you enter in Settings. Leave policy fields blank if you do not want the model referencing them.
- **Human approval required**: No replies are ever sent automatically. All suggested replies start in `Needs approval` status and should be verified by a team member before use or CSV export.
- **Single-chat limits & rate limits**: Conversations are capped at 6,000 characters on the backend, processed with a client concurrency limit of 3, and protected by an in-memory per-IP rate limit (30 requests/minute).
