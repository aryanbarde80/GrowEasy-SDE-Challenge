import cors from "cors";
import express from "express";
import multer from "multer";
import Papa, { type ParseError } from "papaparse";
import { z } from "zod";
import { extractCrmRecords } from "./extractor.js";
import type { CsvRow, ImportResponse, ParsedCsvFile } from "./types.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !FRONTEND_ORIGIN?.length || FRONTEND_ORIGIN.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    provider: process.env.GROQ_API_KEY ? "groq" : "heuristic",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/import", upload.single("file"), async (request, response) => {
  try {
    const file = request.file;

    if (!file) {
      response.status(400).json({ message: "CSV file is required" });
      return;
    }

    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      response.status(400).json({ message: "Only CSV files are supported" });
      return;
    }

    const parsedCsv = parseCsv(file.buffer.toString("utf-8"));

    if (!parsedCsv.rows.length) {
      response.status(400).json({ message: "CSV file is empty or contains no valid data rows" });
      return;
    }

    const { results, meta } = await extractCrmRecords(parsedCsv.rows);
    const importedRecords = results
      .filter((result) => result.action === "import")
      .map((result) => result.crmRecord);
    const skippedRecords = results
      .filter((result) => result.action === "skip")
      .map((result) => ({
        recordId: result.recordId,
        reason: result.skipReason,
      }));

    const payload: ImportResponse = {
      fileName: file.originalname,
      headers: parsedCsv.headers,
      totalRows: parsedCsv.rows.length,
      importedCount: importedRecords.length,
      skippedCount: skippedRecords.length,
      importedRecords,
      skippedRecords,
      processing: meta,
    };

    response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process CSV import";

    response.status(500).json({
      message,
    });
  }
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`GrowEasy importer backend listening on port ${PORT}`);
});

function parseCsv(content: string): ParsedCsvFile {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  if (result.errors.length) {
    const blockingErrors = result.errors.filter(
      (error: ParseError) => error.code !== "UndetectableDelimiter",
    );
    if (blockingErrors.length) {
      throw new Error(blockingErrors[0]?.message ?? "Unable to parse CSV");
    }
  }

  const rowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
  const validRows: CsvRow[] = [];

  for (const row of result.data) {
    const parsed = rowSchema.safeParse(row);

    if (!parsed.success) {
      continue;
    }

    const cleanedRow = Object.fromEntries(
      Object.entries(parsed.data).map(([key, value]) => [
        key.trim(),
        typeof value === "string" ? value : value == null ? "" : String(value),
      ]),
    );

    if (Object.values(cleanedRow).every((value) => !value.trim())) {
      continue;
    }

    validRows.push(cleanedRow);
  }

  const headers =
    result.meta.fields?.map((header: string) => header.trim()).filter(Boolean) ?? [];

  return {
    headers,
    rows: validRows,
  };
}
