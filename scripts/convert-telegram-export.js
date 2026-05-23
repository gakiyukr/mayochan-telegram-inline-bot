import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractQuotesFromExportData } from "../lib/quotes.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultInputPath = path.resolve(scriptDirectory, "../data/result.json");
const defaultOutputPath = path.resolve(
  scriptDirectory,
  "../data/quotes.generated.json"
);

export {
  convertTelegramExport,
  convertTelegramExportData,
  readTelegramExportFile,
  writeGeneratedQuotesFile,
};

function convertTelegramExportData(exportData) {
  return extractQuotesFromExportData(exportData);
}

function convertTelegramExport({
  inputPath = defaultInputPath,
  outputPath = defaultOutputPath,
} = {}) {
  const exportData = readTelegramExportFile(inputPath);
  const quotes = convertTelegramExportData(exportData);

  writeGeneratedQuotesFile(outputPath, quotes);

  return quotes;
}

function readTelegramExportFile(inputPath) {
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

function writeGeneratedQuotesFile(outputPath, quotes) {
  fs.writeFileSync(outputPath, JSON.stringify(quotes, null, 2));
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  convertTelegramExport();
}
