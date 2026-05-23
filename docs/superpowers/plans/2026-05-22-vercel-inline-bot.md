# Vercel Inline Bot Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel-deployable Telegram inline bot that converts a committed Telegram export into runtime-ready quotes during deployment.

**Architecture:** Keep the project small and file-based. A build-time converter reads `data/result.json` and generates `data/quotes.generated.json`, while a Vercel API route reads the generated quotes and answers Telegram inline queries using `process.env.BOT_TOKEN`.

**Tech Stack:** Vercel Node.js Functions, Node.js built-in test runner, JSON file-based data pipeline

---

## File Map

- Create: `C:\Projects\mayochan-telegram-inline-bot\api\telegram.js`
  Vercel API route for Telegram inline queries.
- Create: `C:\Projects\mayochan-telegram-inline-bot\scripts\convert-telegram-export.js`
  Build-time converter from Telegram export to generated quotes JSON.
- Create: `C:\Projects\mayochan-telegram-inline-bot\data\result.json`
  Source Telegram export copied from the current project.
- Create: `C:\Projects\mayochan-telegram-inline-bot\data\quotes.generated.json`
  Generated quotes array written during build.
- Create: `C:\Projects\mayochan-telegram-inline-bot\lib\quotes.js`
  Shared helpers for quote normalization, loading, search, and random sampling.
- Create: `C:\Projects\mayochan-telegram-inline-bot\lib\telegram.js`
  Shared helpers for Telegram API URL creation and inline result formatting.
- Modify: `C:\Projects\mayochan-telegram-inline-bot\package.json`
  Build and test scripts.
- Modify: `C:\Projects\mayochan-telegram-inline-bot\.gitignore`
  Ignore local environment files and generated noise if needed.
- Modify: `C:\Projects\mayochan-telegram-inline-bot\README.md`
  Setup, build, environment, and deployment instructions.
- Create: `C:\Projects\mayochan-telegram-inline-bot\.env.example`
  Local environment example for `BOT_TOKEN`.
- Create: `C:\Projects\mayochan-telegram-inline-bot\api\telegram.test.js`
  API route regression tests.
- Create: `C:\Projects\mayochan-telegram-inline-bot\scripts\convert-telegram-export.test.js`
  Converter regression tests.

### Task 1: Scaffold the Vercel project structure and seed the source data

**Files:**
- Create: `C:\Projects\mayochan-telegram-inline-bot\api\telegram.js`
- Create: `C:\Projects\mayochan-telegram-inline-bot\scripts\convert-telegram-export.js`
- Create: `C:\Projects\mayochan-telegram-inline-bot\lib\quotes.js`
- Create: `C:\Projects\mayochan-telegram-inline-bot\lib\telegram.js`
- Create: `C:\Projects\mayochan-telegram-inline-bot\data\result.json`
- Modify: `C:\Projects\mayochan-telegram-inline-bot\package.json`
- Modify: `C:\Projects\mayochan-telegram-inline-bot\README.md`
- Modify: `C:\Projects\mayochan-telegram-inline-bot\.gitignore`
- Create: `C:\Projects\mayochan-telegram-inline-bot\.env.example`

- [ ] **Step 1: Create the target folders**

```text
api/
data/
lib/
scripts/
```

- [ ] **Step 2: Copy the Telegram export into the target project**

Source:
`C:\Projects\andyneko-bot\result.json`

Destination:
`C:\Projects\mayochan-telegram-inline-bot\data\result.json`

- [ ] **Step 3: Update project metadata and scripts**

`package.json` should define:

```json
{
  "name": "mayochan-telegram-inline-bot",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/convert-telegram-export.js",
    "convert": "node scripts/convert-telegram-export.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 4: Add local environment guidance**

`.env.example`

```env
BOT_TOKEN=your-telegram-bot-token
```

- [ ] **Step 5: Update ignore rules**

Add local environment files:

```gitignore
.env.local
.env
```

### Task 2: Write the failing converter tests

**Files:**
- Create: `C:\Projects\mayochan-telegram-inline-bot\scripts\convert-telegram-export.test.js`
- Create: `C:\Projects\mayochan-telegram-inline-bot\lib\quotes.js`

- [ ] **Step 1: Write a failing test for allowed forwarded names only**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractQuotesFromTelegramExport } from "../lib/quotes.js";

test("extracts only quotes forwarded from Andy蛋黄酱 or 蛋黄酱", () => {
  const input = {
    messages: [
      { type: "message", forwarded_from: "Andy蛋黄酱", text: "A" },
      { type: "message", forwarded_from: "蛋黄酱", text: "B" },
      { type: "message", forwarded_from: "Other", text: "C" },
      { type: "service", forwarded_from: "Andy蛋黄酱", text: "D" }
    ]
  };

  const result = extractQuotesFromTelegramExport(input);

  assert.deepEqual(result, ["A", "B"]);
});
```

- [ ] **Step 2: Write a failing test for mixed text shapes and deduplication**

```js
test("normalizes text arrays, trims whitespace, and deduplicates", () => {
  const input = {
    messages: [
      {
        type: "message",
        forwarded_from: "Andy蛋黄酱",
        text: ["  不要", { text: "恶意" }, "造谣  "]
      },
      {
        type: "message",
        forwarded_from: "Andy蛋黄酱",
        text: "不要恶意造谣"
      }
    ]
  };

  const result = extractQuotesFromTelegramExport(input);

  assert.deepEqual(result, ["不要恶意造谣"]);
});
```

- [ ] **Step 3: Write a failing test for invalid export shape**

```js
test("throws when the export does not contain a messages array", () => {
  assert.throws(
    () => extractQuotesFromTelegramExport({}),
    /messages array/
  );
});
```

- [ ] **Step 4: Run converter tests to verify they fail**

Run: `node --test scripts/convert-telegram-export.test.js`
Expected: FAIL because `extractQuotesFromTelegramExport` does not exist yet

### Task 3: Implement the converter and build-time generation

**Files:**
- Modify: `C:\Projects\mayochan-telegram-inline-bot\lib\quotes.js`
- Modify: `C:\Projects\mayochan-telegram-inline-bot\scripts\convert-telegram-export.js`

- [ ] **Step 1: Implement quote normalization and extraction**

`lib/quotes.js`

```js
const ALLOWED_FORWARDED_FROM = new Set(["Andy蛋黄酱", "蛋黄酱"]);

export function normalizeTelegramText(text) {
  if (typeof text === "string") {
    return text.replace(/\s+/g, " ").trim();
  }

  if (Array.isArray(text)) {
    return text
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
}

export function extractQuotesFromTelegramExport(exportData) {
  if (!Array.isArray(exportData?.messages)) {
    throw new Error("Telegram export must contain a messages array");
  }

  const seen = new Set();
  const quotes = [];

  for (const message of exportData.messages) {
    if (message?.type !== "message") continue;
    if (!ALLOWED_FORWARDED_FROM.has(message?.forwarded_from)) continue;

    const normalized = normalizeTelegramText(message?.text);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    quotes.push(normalized);
  }

  if (quotes.length === 0) {
    throw new Error("No usable quotes found after filtering");
  }

  return quotes;
}
```

- [ ] **Step 2: Implement the converter script**

`scripts/convert-telegram-export.js`

```js
import fs from "node:fs/promises";
import { extractQuotesFromTelegramExport } from "../lib/quotes.js";

const sourcePath = new URL("../data/result.json", import.meta.url);
const outputPath = new URL("../data/quotes.generated.json", import.meta.url);

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const quotes = extractQuotesFromTelegramExport(source);

await fs.writeFile(outputPath, `${JSON.stringify(quotes, null, 2)}\n`, "utf8");
```

- [ ] **Step 3: Run converter tests to verify they pass**

Run: `node --test scripts/convert-telegram-export.test.js`
Expected: PASS

- [ ] **Step 4: Run the converter manually**

Run: `node scripts/convert-telegram-export.js`
Expected: `data/quotes.generated.json` created successfully

### Task 4: Write the failing API tests

**Files:**
- Create: `C:\Projects\mayochan-telegram-inline-bot\api\telegram.test.js`
- Create: `C:\Projects\mayochan-telegram-inline-bot\lib\telegram.js`

- [ ] **Step 1: Write a failing test for missing BOT_TOKEN**

```js
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./telegram.js";

test("returns a configuration error when BOT_TOKEN is missing", async () => {
  const request = new Request("https://example.com/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      inline_query: { id: "inline-1", query: "恶意" }
    })
  });

  const response = await worker.fetch(request);

  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Missing BOT_TOKEN");
});
```

- [ ] **Step 2: Write a failing test for inline query answer flow**

```js
test("answers inline queries from generated quotes", async () => {
  process.env.BOT_TOKEN = "runtime-token";

  const originalFetch = globalThis.fetch;
  const originalRandomUuid = globalThis.crypto?.randomUUID;
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  };

  try {
    globalThis.crypto ??= {};
    globalThis.crypto.randomUUID = () => "test-uuid";

    const request = new Request("https://example.com/api/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inline_query: { id: "inline-2", query: "恶意" }
      })
    });

    const response = await worker.fetch(request);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "inline answered");
    assert.match(calls[0].url, /botruntime-token\/answerInlineQuery/);
  } finally {
    globalThis.fetch = originalFetch;
    if (globalThis.crypto) {
      globalThis.crypto.randomUUID = originalRandomUuid;
    }
    delete process.env.BOT_TOKEN;
  }
});
```

- [ ] **Step 3: Run API tests to verify they fail**

Run: `node --test api/telegram.test.js`
Expected: FAIL because the API route does not exist yet

### Task 5: Implement the Vercel API route

**Files:**
- Modify: `C:\Projects\mayochan-telegram-inline-bot\api\telegram.js`
- Modify: `C:\Projects\mayochan-telegram-inline-bot\lib\quotes.js`
- Modify: `C:\Projects\mayochan-telegram-inline-bot\lib\telegram.js`

- [ ] **Step 1: Add quote loading and search helpers**

Add to `lib/quotes.js`:

```js
import fs from "node:fs/promises";

export function getRandomItems(arr, n) {
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

export function searchQuotes(allQuotes, query, limit = 10) {
  const normalizedQuery = (query || "").trim().toLowerCase();
  const base = normalizedQuery
    ? allQuotes.filter((quote) => quote.toLowerCase().includes(normalizedQuery))
    : allQuotes;

  if (base.length > limit) {
    return getRandomItems(base, limit);
  }

  return base;
}

export async function loadGeneratedQuotes() {
  const filePath = new URL("../data/quotes.generated.json", import.meta.url);
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}
```

- [ ] **Step 2: Add Telegram helper functions**

`lib/telegram.js`

```js
export function getBotToken() {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("Missing BOT_TOKEN");
  }
  return token;
}

export function toInlineResults(texts) {
  return texts.map((text, index) => ({
    type: "article",
    id: globalThis.crypto?.randomUUID?.() ?? String(index),
    title: text,
    description: "点击发送这句话",
    input_message_content: {
      message_text: text
    }
  }));
}

export async function answerInlineQuery(botToken, inlineQueryId, results) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/answerInlineQuery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inline_query_id: inlineQueryId,
        results,
        cache_time: 1,
        is_personal: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.status}`);
  }
}
```

- [ ] **Step 3: Implement the Vercel route**

`api/telegram.js`

```js
import { loadGeneratedQuotes, searchQuotes } from "../lib/quotes.js";
import { answerInlineQuery, getBotToken, toInlineResults } from "../lib/telegram.js";

export default {
  async fetch(request) {
    let botToken;
    try {
      botToken = getBotToken();
    } catch (error) {
      return new Response(error.message, { status: 500 });
    }

    if (request.method === "GET") {
      return new Response("OK");
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const update = await request.json();
    if (!update.inline_query) {
      return new Response("ignored");
    }

    const quotes = await loadGeneratedQuotes();
    const query = update.inline_query.query || "";
    const matches = searchQuotes(quotes, query, 10);
    await answerInlineQuery(botToken, update.inline_query.id, toInlineResults(matches));

    return new Response("inline answered");
  }
};
```

- [ ] **Step 4: Run API tests to verify they pass**

Run: `node --test api/telegram.test.js`
Expected: PASS

### Task 6: Verify build and end-to-end local behavior

**Files:**
- Modify: `C:\Projects\mayochan-telegram-inline-bot\README.md`

- [ ] **Step 1: Document local build and Vercel deployment**

`README.md` should cover:

- project purpose
- required `BOT_TOKEN`
- where to put `data/result.json`
- how `npm run build` generates `data/quotes.generated.json`
- that deployment fails on invalid or empty filtered exports
- how to set the Telegram webhook to the deployed Vercel route

- [ ] **Step 2: Run the full test suite**

Run: `node --test`
Expected: PASS

- [ ] **Step 3: Run the build pipeline**

Run: `npm run build`
Expected: `data/quotes.generated.json` regenerated successfully

- [ ] **Step 4: Verify generated data exists**

Check:
`C:\Projects\mayochan-telegram-inline-bot\data\quotes.generated.json`

- [ ] **Step 5: Commit**

```bash
git add api data lib scripts package.json README.md .gitignore .env.example docs
git commit -m "Build Vercel inline bot with deployment-time quote generation"
```
