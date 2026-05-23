const TELEGRAM_API_BASE_URL = "https://api.telegram.org";

export {
  answerInlineQuery,
  buildInlineQueryResults,
  createInlineArticleResult,
  getTelegramApiUrl,
  TelegramRequestError,
};

class TelegramRequestError extends Error {
  constructor(message, { cause, status } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "TelegramRequestError";
    this.status = status;
  }
}

function getTelegramApiUrl(botToken, method) {
  return `${TELEGRAM_API_BASE_URL}/bot${botToken}/${method}`;
}

function createInlineArticleResult(quote, index) {
  return {
    type: "article",
    id: String(index + 1),
    title: quote,
    input_message_content: {
      message_text: quote,
    },
  };
}

function buildInlineQueryResults(quotes) {
  return quotes.map((quote, index) => createInlineArticleResult(quote, index));
}

async function answerInlineQuery({
  botToken,
  inlineQueryId,
  results,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new TelegramRequestError("fetch is required to answer inline queries.");
  }

  let response;

  try {
    response = await fetchImpl(getTelegramApiUrl(botToken, "answerInlineQuery"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inline_query_id: inlineQueryId,
        results,
        cache_time: 0,
      }),
    });
  } catch (error) {
    throw new TelegramRequestError("Telegram request failed.", { cause: error });
  }

  if (!response.ok) {
    throw new TelegramRequestError("Telegram answerInlineQuery request failed.", {
      status: response.status,
    });
  }

  let responseBody;

  try {
    responseBody = await response.json();
  } catch (error) {
    throw new TelegramRequestError("Telegram response JSON was invalid.", {
      cause: error,
      status: response.status,
    });
  }

  if (responseBody?.ok !== true) {
    throw new TelegramRequestError("Telegram Bot API reported failure.", {
      status: response.status,
    });
  }

  return responseBody;
}
