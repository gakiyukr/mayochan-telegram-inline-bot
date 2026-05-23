import test from "node:test";
import assert from "node:assert/strict";

import { createTelegramHandler } from "./telegram.js";

const ORIGINAL_ENV = process.env.BOT_TOKEN;
const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_RANDOM = Math.random;

test.afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.BOT_TOKEN;
  } else {
    process.env.BOT_TOKEN = ORIGINAL_ENV;
  }

  if (ORIGINAL_FETCH === undefined) {
    delete globalThis.fetch;
  } else {
    globalThis.fetch = ORIGINAL_FETCH;
  }

  Math.random = ORIGINAL_RANDOM;
});

test("returns a configuration error when BOT_TOKEN is missing", async () => {
  delete process.env.BOT_TOKEN;

  const response = createResponseRecorder();
  const handler = createTelegramHandler();

  await handler(createRequest({ method: "POST", body: {} }), response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.body, "Missing BOT_TOKEN");
});

test("returns OK for GET requests", async () => {
  process.env.BOT_TOKEN = "test-token";

  const response = createResponseRecorder();
  const handler = createTelegramHandler();

  await handler(createRequest({ method: "GET" }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "OK");
});

test("ignores updates without inline_query", async () => {
  process.env.BOT_TOKEN = "test-token";

  const response = createResponseRecorder();
  const handler = createTelegramHandler();

  await handler(createRequest({ method: "POST", body: { update_id: 1 } }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "ignored");
});

test("returns 405 for unsupported HTTP methods", async () => {
  process.env.BOT_TOKEN = "test-token";

  const response = createResponseRecorder();
  const handler = createTelegramHandler();

  await handler(createRequest({ method: "PUT", body: {} }), response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.body, "Method Not Allowed");
});

test("returns a controlled response for malformed string bodies", async () => {
  process.env.BOT_TOKEN = "test-token";

  const response = createResponseRecorder();
  const handler = createTelegramHandler();

  await handler(
    createRequest({
      method: "POST",
      body: "{ not valid json",
    }),
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body, "Invalid webhook body");
});

test("answers inline queries from injected quotes using substring search", async () => {
  process.env.BOT_TOKEN = "test-token";

  const fetchCalls = [];
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });

    return {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  };

  const response = createResponseRecorder();
  const handler = createTelegramHandler({
    loadQuotes() {
      return ["Alpha wifi quote", "Beta tea quote"];
    },
  });

  await handler(
    createRequest({
      method: "POST",
      body: {
        inline_query: {
          id: "abc123",
          query: "wIfI",
        },
      },
    }),
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "OK");
  assert.equal(fetchCalls.length, 1);

  const [call] = fetchCalls;
  assert.equal(
    call.url,
    "https://api.telegram.org/bottest-token/answerInlineQuery"
  );
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.headers["content-type"], "application/json");

  const payload = JSON.parse(call.options.body);
  assert.equal(payload.inline_query_id, "abc123");
  assert.equal(payload.results.length, 1);
  assert.equal(payload.results[0].type, "article");
  assert.equal(payload.results[0].title, "Alpha wifi quote");
  assert.equal(payload.results[0].input_message_content.message_text, "Alpha wifi quote");
});

test("returns a random sample when inline query text is empty", async () => {
  process.env.BOT_TOKEN = "test-token";
  Math.random = () => 0;

  let capturedPayload;
  globalThis.fetch = async (_url, options) => {
    capturedPayload = JSON.parse(options.body);

    return {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  };

  const response = createResponseRecorder();
  const handler = createTelegramHandler({
    loadQuotes() {
      return ["First quote", "Second quote", "Third quote"];
    },
  });

  await handler(
    createRequest({
      method: "POST",
      body: {
        inline_query: {
          id: "sample-1",
          query: "   ",
        },
      },
    }),
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "OK");
  assert.equal(capturedPayload.inline_query_id, "sample-1");
  assert.deepEqual(
    capturedPayload.results.map((result) => result.title),
    ["First quote", "Second quote", "Third quote"]
  );
});

test("limits large search result sets before sending them to Telegram", async () => {
  process.env.BOT_TOKEN = "test-token";

  let capturedPayload;
  globalThis.fetch = async (_url, options) => {
    capturedPayload = JSON.parse(options.body);

    return {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  };

  const response = createResponseRecorder();
  const largeQuoteSet = Array.from({ length: 80 }, (_, index) => `猫 quote ${index + 1}`);
  const handler = createTelegramHandler({
    loadQuotes() {
      return largeQuoteSet;
    },
  });

  await handler(
    createRequest({
      method: "POST",
      body: {
        inline_query: {
          id: "large-match-set",
          query: "猫",
        },
      },
    }),
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "OK");
  assert.ok(capturedPayload.results.length <= 50);
});

test("returns a controlled error when fetch is unavailable downstream", async () => {
  process.env.BOT_TOKEN = "test-token";
  delete globalThis.fetch;

  const response = createResponseRecorder();
  const handler = createTelegramHandler({
    loadQuotes() {
      return ["Alpha wifi quote"];
    },
  });

  await handler(
    createRequest({
      method: "POST",
      body: {
        inline_query: {
          id: "missing-fetch",
          query: "wifi",
        },
      },
    }),
    response
  );

  assert.equal(response.statusCode, 502);
  assert.equal(response.body, "Failed to answer inline query");
});

test("returns a controlled error when Telegram responds with non-OK", async () => {
  process.env.BOT_TOKEN = "test-token";
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    async text() {
      return "telegram error";
    },
  });

  const response = createResponseRecorder();
  const handler = createTelegramHandler({
    loadQuotes() {
      return ["Alpha wifi quote"];
    },
  });

  await handler(
    createRequest({
      method: "POST",
      body: {
        inline_query: {
          id: "telegram-non-ok",
          query: "wifi",
        },
      },
    }),
    response
  );

  assert.equal(response.statusCode, 502);
  assert.equal(response.body, "Failed to answer inline query");
});

test("returns a controlled error when Telegram JSON reports ok false", async () => {
  process.env.BOT_TOKEN = "test-token";
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { ok: false, description: "telegram rejected request" };
    },
  });

  const response = createResponseRecorder();
  const handler = createTelegramHandler({
    loadQuotes() {
      return ["Alpha wifi quote"];
    },
  });

  await handler(
    createRequest({
      method: "POST",
      body: {
        inline_query: {
          id: "telegram-ok-false",
          query: "wifi",
        },
      },
    }),
    response
  );

  assert.equal(response.statusCode, 502);
  assert.equal(response.body, "Failed to answer inline query");
});

function createRequest({ method, body } = {}) {
  return {
    method,
    body,
  };
}

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    json(value) {
      this.setHeader("content-type", "application/json");
      this.body = JSON.stringify(value);
      return this;
    },
  };
}
