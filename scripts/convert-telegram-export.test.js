import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { extractQuotesFromExportData } from "../lib/quotes.js";
import {
  convertTelegramExport,
  convertTelegramExportData,
} from "./convert-telegram-export.js";

test("extracts only quotes forwarded from Andy蛋黄酱 or 蛋黄酱", () => {
  const exportData = {
    messages: [
      {
        type: "message",
        forwarded_from: "Andy蛋黄酱",
        text: "first quote",
      },
      {
        type: "message",
        forwarded_from: "蛋黄酱",
        text: "second quote",
      },
      {
        type: "message",
        forwarded_from: "Someone Else",
        text: "should be ignored",
      },
      {
        type: "service",
        forwarded_from: "Andy蛋黄酱",
        text: "also ignored",
      },
      {
        type: "message",
        text: "missing source",
      },
    ],
  };

  assert.deepEqual(extractQuotesFromExportData(exportData), [
    "first quote",
    "second quote",
  ]);
});

test("normalizes text arrays, trims whitespace, and deduplicates", () => {
  const exportData = {
    messages: [
      {
        type: "message",
        forwarded_from: "Andy蛋黄酱",
        text: ["  Hello", "   ", { text: "world  " }],
      },
      {
        type: "message",
        forwarded_from: "蛋黄酱",
        text: "Hello world",
      },
      {
        type: "message",
        forwarded_from: "Andy蛋黄酱",
        text: [{ text: "\nSecond\tquote\n" }],
      },
      {
        type: "message",
        forwarded_from: "Andy蛋黄酱",
        text: ["   ", { text: "   " }],
      },
    ],
  };

  assert.deepEqual(extractQuotesFromExportData(exportData), [
    "Hello world",
    "Second quote",
  ]);
});

test("throws when the export does not contain a messages array", () => {
  assert.throws(
    () => extractQuotesFromExportData({ messages: null }),
    /messages array/i
  );
});

test("throws when filtering leaves zero usable quotes", () => {
  const exportData = {
    messages: [
      {
        type: "message",
        forwarded_from: "Someone Else",
        text: "ignored",
      },
      {
        type: "service",
        forwarded_from: "Andy蛋黄酱",
        text: "ignored",
      },
      {
        type: "message",
        forwarded_from: "蛋黄酱",
        text: "   ",
      },
    ],
  };

  assert.throws(
    () => extractQuotesFromExportData(exportData),
    /no usable quotes/i
  );
});

test("converts export data without touching the filesystem", () => {
  const exportData = {
    messages: [
      {
        type: "message",
        forwarded_from: "Andy蛋黄酱",
        text: "  pure quote  ",
      },
      {
        type: "message",
        forwarded_from: "Someone Else",
        text: "ignored",
      },
    ],
  };

  assert.deepEqual(convertTelegramExportData(exportData), ["pure quote"]);
});

test("reads data/result.json and writes data/quotes.generated.json", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "mayochan-convert-telegram-export-")
  );
  const inputPath = path.join(tempDir, "result.json");
  const outputPath = path.join(tempDir, "quotes.generated.json");

  fs.writeFileSync(
    inputPath,
    JSON.stringify({
      messages: [
        {
          type: "message",
          forwarded_from: "Andy蛋黄酱",
          text: "  a quote  ",
        },
      ],
    })
  );

  convertTelegramExport({ inputPath, outputPath });

  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), ["a quote"]);
});

test("throws when the input file is missing", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "mayochan-convert-telegram-export-")
  );
  const inputPath = path.join(tempDir, "missing.json");
  const outputPath = path.join(tempDir, "quotes.generated.json");

  assert.throws(
    () => convertTelegramExport({ inputPath, outputPath }),
    /ENOENT/
  );
});

test("throws when the input file contains invalid JSON", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "mayochan-convert-telegram-export-")
  );
  const inputPath = path.join(tempDir, "result.json");
  const outputPath = path.join(tempDir, "quotes.generated.json");

  fs.writeFileSync(inputPath, "{ not valid json", "utf8");

  assert.throws(
    () => convertTelegramExport({ inputPath, outputPath }),
    SyntaxError
  );
});

test("uses the default project data paths when called without overrides", async () => {
  const modulePath = pathToFileURL(
    path.join(process.cwd(), "scripts/convert-telegram-export.js")
  ).href;
  const quotesPath = path.join(process.cwd(), "data/quotes.generated.json");
  const originalGeneratedQuotes = fs.existsSync(quotesPath)
    ? fs.readFileSync(quotesPath, "utf8")
    : null;

  try {
    const { convertTelegramExport: convertWithDefaults } = await import(
      `${modulePath}?default-path-test=${Date.now()}`
    );

    const quotes = convertWithDefaults();

    assert.deepEqual(JSON.parse(fs.readFileSync(quotesPath, "utf8")), quotes);
  } finally {
    if (originalGeneratedQuotes === null) {
      fs.rmSync(quotesPath, { force: true });
    } else {
      fs.writeFileSync(quotesPath, originalGeneratedQuotes, "utf8");
    }
  }
});
