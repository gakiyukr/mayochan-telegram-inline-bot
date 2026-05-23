# Mayochan Telegram Inline Bot Vercel Migration Design

**Goal**

Build a Vercel-deployable Telegram inline bot in `C:\Projects\mayochan-telegram-inline-bot` that automatically converts a committed Telegram export file into a runtime-ready quotes JSON during deployment.

**Primary Outcome**

After each deployment, the bot should answer Telegram inline queries using a generated quotes dataset derived from `data/result.json`, while only accepting messages forwarded from exactly `"Andy蛋黄酱"` or `"蛋黄酱"`.

## Scope

### In Scope

- Create a Vercel-compatible API route for the Telegram inline bot
- Read the Telegram bot token from `process.env.BOT_TOKEN`
- Convert `data/result.json` into `data/quotes.generated.json` during build/deploy
- Restrict quote extraction to messages with `forwarded_from` equal to `"Andy蛋黄酱"` or `"蛋黄酱"`
- Keep the inline-search behavior simple: case-insensitive contains match, random sampling for result limiting
- Add minimal automated tests for conversion behavior and API behavior
- Document the local and Vercel deployment flow

### Out of Scope

- Uploading Telegram exports through a web UI
- Runtime editing of the quotes dataset
- Moving quote data into a database or object storage
- Rich ranking, tagging, or semantic search
- Supporting any forwarded sender names beyond the two exact values above

## Architecture

The project will use a build-time data pipeline plus a runtime API route. `data/result.json` is the source-of-truth Telegram export committed to the repository. During build, a conversion script reads that export, filters and normalizes messages, and writes `data/quotes.generated.json`. At runtime, the Vercel function reads the generated file and serves Telegram inline query responses from that simplified dataset.

This split keeps deployment deterministic and runtime logic lightweight. The deployed function does not need to understand Telegram export internals, reactions, metadata, or service messages. It only works with a clean string array generated ahead of time.

## File Structure

The target project will be organized like this:

- `api/telegram.js`
  Vercel API route that handles Telegram webhook requests and answers inline queries.
- `scripts/convert-telegram-export.js`
  Build-time converter from raw Telegram export to generated quote list.
- `data/result.json`
  Raw Telegram export committed to the repository.
- `data/quotes.generated.json`
  Generated string array consumed by the runtime API.
- `package.json`
  Build and test scripts for local use and Vercel deployment.
- `.gitignore`
  Ignore local-only files such as `.env.local`.
- `README.md`
  Setup, build, environment, and deployment instructions.
- `*.test.js`
  Minimal regression coverage for converter and API behavior.

## Data Conversion Rules

The converter will load `data/result.json` and require it to look like a Telegram export with a top-level `messages` array.

Each output quote must satisfy all of the following:

- The source entry has `type === "message"`
- The source entry has `forwarded_from === "Andy蛋黄酱"` or `forwarded_from === "蛋黄酱"`
- The source entry produces non-empty text after normalization

Text normalization rules:

- If `text` is a string, use it directly
- If `text` is an array, join string items and object `.text` fields in order
- Trim leading and trailing whitespace
- Collapse repeated whitespace to a single space
- Drop empty results
- De-duplicate while preserving first-seen order

Output format:

```json
[
  "不要恶意造谣",
  "我只喜欢女的",
  "喵pay"
]
```

## Build Failure Rules

The build must fail with a clear error message in either of these cases:

- `data/result.json` is missing, unreadable, invalid JSON, or not a valid Telegram export shape
- After filtering and normalization, zero usable quotes remain

This is intentional. A failed build is safer than silently deploying a bot with broken or empty data.

## Runtime Behavior

The Vercel API route will:

- Return a simple OK response for GET requests
- Parse POST webhook requests from Telegram
- Ignore updates that do not contain `inline_query`
- Read `BOT_TOKEN` from `process.env`
- Load the generated quotes dataset
- If the inline query text is empty, return a random sample
- If the inline query text is present, do a case-insensitive substring search
- Convert matches into Telegram inline articles and answer the inline query

The runtime function will not fetch `data/result.json` or run the converter. All conversion happens before deployment finishes.

## Environment and Configuration

Required environment variable:

- `BOT_TOKEN`

Local development may use `.env.local` or another local-only environment file supported by the chosen local workflow. That file must not be committed.

Vercel production will use the project environment variable configuration in the Vercel dashboard or CLI.

## Deployment Flow

The deployment flow is:

1. Commit updated `data/result.json` to the repository
2. Start a Vercel deployment
3. Run the converter script during build
4. Generate `data/quotes.generated.json`
5. Build and deploy the Vercel API route
6. Serve inline query traffic from the generated dataset

This means the repository author only needs to update `data/result.json` and redeploy. No separate manual export-conversion step is required.

## Testing Strategy

The minimum regression suite will cover:

- Converter extracts only messages forwarded from `"Andy蛋黄酱"` or `"蛋黄酱"`
- Converter rejects invalid or empty usable datasets
- API route returns a clear configuration error when `BOT_TOKEN` is missing
- API route answers inline queries from generated quotes data

The tests should stay lightweight and avoid network dependence by stubbing fetch where needed.

## Risks and Constraints

- Large Telegram exports will increase build time, though the current JSON size appears manageable
- If Telegram export structure changes, the converter may need updates
- Exact-name filtering is intentionally strict; forwarded messages from visually similar but different names will be ignored
- Because quote generation happens at build time, content updates require a new deployment

## Recommendation

Proceed with the build-time conversion architecture. It is the best fit for the current repository size, the desired Vercel workflow, and the requirement that `result.json` live in the repo while deployments automatically produce runtime-ready quote data.
