import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APPROVED_FORWARDED_FROM_VALUES = Object.freeze([
  "Andy蛋黄酱",
  "蛋黄酱",
]);
const APPROVED_FORWARDED_FROM_SET = new Set(APPROVED_FORWARDED_FROM_VALUES);

const libraryDirectory = path.dirname(fileURLToPath(import.meta.url));
const generatedQuotesPath = path.resolve(
  libraryDirectory,
  "../data/quotes.generated.json"
);
const generatedQuotesCache = new Map();

export {
  APPROVED_FORWARDED_FROM_VALUES,
  extractQuotesFromExportData,
  loadGeneratedQuotes,
  searchQuotes,
  sampleQuotes,
};

function extractQuotesFromExportData(exportData) {
  if (!Array.isArray(exportData?.messages)) {
    throw new Error("Telegram export must contain a messages array.");
  }

  const quotes = [];
  const seenQuotes = new Set();

  for (const message of exportData.messages) {
    if (message?.type !== "message") {
      continue;
    }

    if (!APPROVED_FORWARDED_FROM_SET.has(message.forwarded_from)) {
      continue;
    }

    const normalizedQuote = normalizeQuoteText(message.text);

    if (!normalizedQuote || seenQuotes.has(normalizedQuote)) {
      continue;
    }

    seenQuotes.add(normalizedQuote);
    quotes.push(normalizedQuote);
  }

  if (quotes.length === 0) {
    throw new Error("No usable quotes remained after filtering.");
  }

  return quotes;
}

function normalizeQuoteText(text) {
  if (typeof text === "string") {
    return collapseWhitespace(text);
  }

  if (Array.isArray(text)) {
    const joinedText = text
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("");

    return collapseWhitespace(joinedText);
  }

  return "";
}

function collapseWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function loadGeneratedQuotes(inputPath = generatedQuotesPath) {
  if (generatedQuotesCache.has(inputPath)) {
    return generatedQuotesCache.get(inputPath);
  }

  const quotes = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  if (!Array.isArray(quotes)) {
    throw new Error("Generated quotes file must contain an array.");
  }

  const filteredQuotes = quotes.filter(
    (quote) => typeof quote === "string" && quote.length > 0
  );

  generatedQuotesCache.set(inputPath, filteredQuotes);

  return filteredQuotes;
}

function searchQuotes(quotes, query) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return quotes.filter((quote) =>
    quote.toLowerCase().includes(normalizedQuery)
  );
}

function sampleQuotes(quotes, limit = 10) {
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return [];
  }

  const sampleSize = Math.min(limit, quotes.length);
  const startIndex = Math.floor(Math.random() * quotes.length);
  const results = [];

  for (let index = 0; index < sampleSize; index += 1) {
    results.push(quotes[(startIndex + index) % quotes.length]);
  }

  return results;
}
