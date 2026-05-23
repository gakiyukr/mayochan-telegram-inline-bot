import {
  loadGeneratedQuotes,
  sampleQuotes,
  searchQuotes,
} from "../lib/quotes.js";
import {
  answerInlineQuery,
  buildInlineQueryResults,
  TelegramRequestError,
} from "../lib/telegram.js";

export { createTelegramHandler };

const handler = createTelegramHandler();

export default handler;

function createTelegramHandler({
  loadQuotes = loadGeneratedQuotes,
  answerInlineQueryImpl = answerInlineQuery,
} = {}) {
  return async function telegramHandler(req, res) {
    if (req.method === "GET") {
      return res.status(200).send("OK");
    }

    if (req.method !== "POST") {
      res.setHeader("allow", "GET, POST");
      return res.status(405).send("Method Not Allowed");
    }

    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      return res.status(500).send("Missing BOT_TOKEN");
    }

    let update;

    try {
      update = readWebhookUpdate(req.body);
    } catch (_error) {
      return res.status(400).send("Invalid webhook body");
    }

    const inlineQuery = update.inline_query;

    if (!inlineQuery) {
      return res.status(200).send("ignored");
    }

    const quotes = loadQuotes();
    const queryText = String(inlineQuery.query ?? "");
    const matchedQuotes = queryText.trim()
      ? searchQuotes(quotes, queryText)
      : sampleQuotes(quotes);
    const results = buildInlineQueryResults(matchedQuotes);

    try {
      await answerInlineQueryImpl({
        botToken,
        inlineQueryId: inlineQuery.id,
        results,
      });
    } catch (error) {
      if (error instanceof TelegramRequestError) {
        return res.status(502).send("Failed to answer inline query");
      }

      throw error;
    }

    return res.status(200).send("OK");
  };
}

function readWebhookUpdate(body) {
  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body ?? {};
}
