# mayochan-telegram-inline-bot

Vercel-hosted Telegram inline bot for serving Telegram inline query results from a committed Telegram export.

## How it works

The project keeps the raw Telegram export in `data/result.json`.

During build or deployment:

1. `scripts/convert-telegram-export.js` reads `data/result.json`
2. it filters only messages forwarded from `Andy蛋黄酱` or `蛋黄酱`
3. it writes the generated runtime dataset to `data/quotes.generated.json`
4. the Vercel route in `api/telegram.js` serves inline queries from that generated file

## Project layout

- `api/telegram.js`
  Telegram webhook route for Vercel
- `data/result.json`
  committed Telegram export input
- `data/quotes.generated.json`
  generated quotes array used at runtime
- `lib/quotes.js`
  quote extraction, loading, search, and sampling helpers
- `lib/telegram.js`
  Telegram API helpers
- `scripts/convert-telegram-export.js`
  build-time conversion entry point

## Environment

Set the Telegram bot token through an environment variable:

```env
BOT_TOKEN=your-telegram-bot-token
```

Local example: `.env.example`

In Vercel, add `BOT_TOKEN` in the project environment variables.

## Commands

Generate the runtime quotes file:

```bash
npm run build
```

Run the converter directly:

```bash
npm run convert
```

Run tests:

```bash
npm test
```

## Deployment flow

1. Replace `data/result.json` with the latest Telegram export
2. Commit and push the repo
3. Deploy to Vercel
4. Vercel runs the build command and regenerates `data/quotes.generated.json`
5. Point the Telegram webhook to your deployed route:

```text
https://your-project.vercel.app/api/telegram
```

## Failure behavior

The build fails if:

- `data/result.json` is missing or invalid
- no usable forwarded quotes remain after filtering

The runtime returns controlled errors for:

- missing `BOT_TOKEN`
- invalid webhook JSON
- Telegram API failure while answering inline queries
