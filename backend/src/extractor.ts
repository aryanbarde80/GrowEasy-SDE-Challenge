import OpenAI from "openai";
import {
  ALLOWED_CRM_STATUSES,
  ALLOWED_DATA_SOURCES,
  type AllowedCrmStatus,
  type AllowedDataSource,
  type CrmRecord,
  type CsvRow,
  type ExtractionResult,
} from "./types.js";

const BATCH_SIZE = Number(process.env.AI_BATCH_SIZE ?? 8);
const MAX_RETRIES = Number(process.env.AI_BATCH_RETRIES ?? 1);

type RowEnvelope = {
  recordId: string;
  row: CsvRow;
};

const CRM_TEMPLATE: CrmRecord = {
  created_at: "",
  name: "",
  email: "",
  country_code: "",
  mobile_without_country_code: "",
  company: "",
  city: "",
  state: "",
  country: "",
  lead_owner: "",
  crm_status: "",
  crm_note: "",
  data_source: "",
  possession_time: "",
  description: "",
};

const HEADER_ALIASES: Array<[keyof CrmRecord, string[]]> = [
  ["created_at", ["created", "creation", "date", "timestamp", "time", "created_at", "lead created"]],
  ["name", ["name", "full name", "lead name", "customer name", "client name"]],
  ["email", ["email", "email address", "mail", "primary email"]],
  ["country_code", ["country code", "isd", "dial code", "country_code"]],
  ["mobile_without_country_code", ["phone", "mobile", "whatsapp", "contact", "mobile number", "phone number"]],
  ["company", ["company", "organization", "firm", "business"]],
  ["city", ["city", "town"]],
  ["state", ["state", "province", "region"]],
  ["country", ["country", "nation"]],
  ["lead_owner", ["lead owner", "owner", "assigned to", "assignee", "agent", "executive", "counsellor"]],
  ["crm_status", ["status", "lead status", "crm status", "disposition"]],
  ["crm_note", ["note", "notes", "remark", "remarks", "comment", "comments", "follow up", "feedback"]],
  ["data_source", ["source", "lead source", "data source", "campaign", "project"]],
  ["possession_time", ["possession", "possession time", "handover", "move in", "timeline"]],
  ["description", ["description", "details", "message", "summary", "requirement", "query"]],
];

export interface ExtractionMeta {
  provider: "groq" | "heuristic";
  usedFallback: boolean;
  batchSize: number;
  failedBatchRetries: number;
}

const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";

export async function extractCrmRecords(rows: CsvRow[]): Promise<{
  results: ExtractionResult[];
  meta: ExtractionMeta;
}> {
  const envelopes = rows.map((row, index) => ({
    recordId: `row_${index + 1}`,
    row,
  }));

  if (!process.env.GROQ_API_KEY) {
    return {
      results: envelopes.map((envelope) => extractWithHeuristics(envelope)),
      meta: {
        provider: "heuristic",
        usedFallback: true,
        batchSize: BATCH_SIZE,
        failedBatchRetries: 0,
      },
    };
  }

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
  });
  const results: ExtractionResult[] = [];
  let failedBatchRetries = 0;
  let usedFallback = false;

  for (let index = 0; index < envelopes.length; index += BATCH_SIZE) {
    const batch = envelopes.slice(index, index + BATCH_SIZE);
    const aiBatchResult = await tryExtractBatchWithAi(client, batch);

    if (aiBatchResult.success) {
      results.push(...aiBatchResult.results);
      failedBatchRetries += aiBatchResult.failedRetries;
      continue;
    }

    usedFallback = true;
    failedBatchRetries += aiBatchResult.failedRetries;
    results.push(...batch.map((envelope) => extractWithHeuristics(envelope)));
  }

  return {
    results,
    meta: {
      provider: "groq",
      usedFallback,
      batchSize: BATCH_SIZE,
      failedBatchRetries,
    },
  };
}

async function tryExtractBatchWithAi(
  client: OpenAI,
  batch: RowEnvelope[],
): Promise<
  | { success: true; results: ExtractionResult[]; failedRetries: number }
  | { success: false; failedRetries: number }
> {
  let failedRetries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You extract CRM records from messy CSV rows.",
              "Map any available fields into the exact GrowEasy CRM schema.",
              "Return JSON with shape: {\"results\": [{\"recordId\": string, \"action\": \"import\" | \"skip\", \"crmRecord\"?: CrmRecord, \"skipReason\"?: string}]}",
              "If neither email nor mobile exists, skip the row.",
              `crm_status must be one of ${ALLOWED_CRM_STATUSES.join(", ")} or empty string.`,
              `data_source must be one of ${ALLOWED_DATA_SOURCES.join(", ")} or empty string.`,
              "created_at must be a JavaScript-compatible date string or empty string.",
              "Use the first email and first mobile number as primary values.",
              "Append remaining emails or mobile numbers to crm_note.",
              "crm_note must include remarks, comments, extra emails, extra numbers, and leftover useful details.",
              "Do not invent values when uncertain. Prefer empty string.",
              "Keep every property as a string, never null.",
              "Avoid line breaks inside crm_note and description. Use semicolons instead.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              rows: batch,
              crmTemplate: CRM_TEMPLATE,
            }),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as { results?: Array<Record<string, unknown>> };

      if (!parsed.results || !Array.isArray(parsed.results)) {
        throw new Error("AI response missing results array");
      }

      return {
        success: true,
        results: parsed.results.map((item) => sanitizeAiResult(item)),
        failedRetries,
      };
    } catch (error) {
      failedRetries += 1;
      if (attempt === MAX_RETRIES) {
        return { success: false, failedRetries };
      }
    }
  }

  return { success: false, failedRetries };
}

function sanitizeAiResult(item: Record<string, unknown>): ExtractionResult {
  const action = item.action === "skip" ? "skip" : "import";
  const recordId = asString(item.recordId);

  if (action === "skip") {
    return {
      action: "skip",
      recordId,
      skipReason: asString(item.skipReason) || "Missing both email and mobile number",
    };
  }

  const crmRecordInput = (item.crmRecord ?? {}) as Record<string, unknown>;
  const crmRecord = sanitizeCrmRecord(crmRecordInput);

  if (!crmRecord.email && !crmRecord.mobile_without_country_code) {
    return {
      action: "skip",
      recordId,
      skipReason: "Missing both email and mobile number",
    };
  }

  return {
    action: "import",
    recordId,
    crmRecord,
  };
}

export function extractWithHeuristics(envelope: RowEnvelope): ExtractionResult {
  const row = normalizeRow(envelope.row);
  const crmRecord = { ...CRM_TEMPLATE };
  const consumedHeaders = new Set<string>();

  for (const [field, aliases] of HEADER_ALIASES) {
    const header = findBestHeader(row, aliases);
    if (!header) {
      continue;
    }

    consumedHeaders.add(header);
    const value = row[header];

    switch (field) {
      case "created_at":
        crmRecord.created_at = normalizeDate(value);
        break;
      case "crm_status":
        crmRecord.crm_status = normalizeCrmStatus(value);
        break;
      case "data_source":
        crmRecord.data_source = normalizeDataSource(value);
        break;
      case "country_code": {
        const phone = splitPhone(value);
        crmRecord.country_code = phone.countryCode;
        if (!crmRecord.mobile_without_country_code) {
          crmRecord.mobile_without_country_code = phone.mobile;
        }
        break;
      }
      case "mobile_without_country_code": {
        const phone = splitPhone(value);
        if (!crmRecord.country_code) {
          crmRecord.country_code = phone.countryCode;
        }
        crmRecord.mobile_without_country_code = phone.mobile;
        break;
      }
      default:
        crmRecord[field] = cleanText(value) as never;
    }
  }

  const allValues = Object.values(row).map((value) => cleanText(value)).filter(Boolean);
  const emails = dedupe(findEmails(allValues.join(" ")));
  const phones = dedupe(findPhonesFromRow(row));

  if (!crmRecord.email && emails[0]) {
    crmRecord.email = emails[0];
  }

  if (!crmRecord.mobile_without_country_code && phones[0]) {
    const phone = splitPhone(phones[0]);
    crmRecord.country_code ||= phone.countryCode;
    crmRecord.mobile_without_country_code = phone.mobile;
  }

  if (!crmRecord.name) {
    crmRecord.name = inferName(row);
  }

  crmRecord.created_at ||= inferDate(row);
  crmRecord.crm_status ||= inferStatusFromContext(row);
  crmRecord.data_source ||= inferDataSourceFromContext(row);

  const extraDetails: string[] = [];
  const extraEmails = emails.filter((email) => email !== crmRecord.email);
  const extraPhones = phones.filter((phone) => splitPhone(phone).mobile !== crmRecord.mobile_without_country_code);

  if (extraEmails.length) {
    extraDetails.push(`Extra emails: ${extraEmails.join(", ")}`);
  }

  if (extraPhones.length) {
    extraDetails.push(`Extra phones: ${extraPhones.join(", ")}`);
  }

  const leftoverPairs = Object.entries(row)
    .filter(([header, value]) => !consumedHeaders.has(header) && cleanText(value))
    .map(([header, value]) => `${header}: ${cleanText(value)}`);

  if (!crmRecord.crm_note) {
    crmRecord.crm_note = leftoverPairs.slice(0, 4).join("; ");
  } else if (leftoverPairs.length) {
    extraDetails.push(...leftoverPairs.slice(0, 4));
  }

  if (crmRecord.description) {
    crmRecord.description = cleanText(crmRecord.description);
  } else if (leftoverPairs.length > 4) {
    crmRecord.description = leftoverPairs.slice(4, 8).join("; ");
  }

  crmRecord.crm_note = cleanText([crmRecord.crm_note, ...extraDetails].filter(Boolean).join("; "));

  const finalRecord = sanitizeCrmRecord(crmRecord);

  if (!finalRecord.email && !finalRecord.mobile_without_country_code) {
    return {
      action: "skip",
      recordId: envelope.recordId,
      skipReason: "Missing both email and mobile number",
    };
  }

  return {
    action: "import",
    recordId: envelope.recordId,
    crmRecord: finalRecord,
  };
}

function normalizeRow(row: CsvRow): CsvRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [cleanText(key), cleanText(value)]),
  );
}

function sanitizeCrmRecord(input: Record<string, unknown>): CrmRecord {
  const sanitized: CrmRecord = {
    created_at: normalizeDate(asString(input.created_at)),
    name: cleanText(asString(input.name)),
    email: normalizeEmail(asString(input.email)),
    country_code: normalizeCountryCode(asString(input.country_code)),
    mobile_without_country_code: normalizeMobile(asString(input.mobile_without_country_code)),
    company: cleanText(asString(input.company)),
    city: cleanText(asString(input.city)),
    state: cleanText(asString(input.state)),
    country: cleanText(asString(input.country)),
    lead_owner: cleanText(asString(input.lead_owner)),
    crm_status: normalizeCrmStatus(asString(input.crm_status)),
    crm_note: cleanText(asString(input.crm_note)),
    data_source: normalizeDataSource(asString(input.data_source)),
    possession_time: cleanText(asString(input.possession_time)),
    description: cleanText(asString(input.description)),
  };

  if (sanitized.mobile_without_country_code && !sanitized.country_code) {
    sanitized.country_code = "+91";
  }

  return sanitized;
}

function findBestHeader(row: CsvRow, aliases: string[]): string | undefined {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias));
  return Object.keys(row).find((header) => {
    const normalizedHeader = normalizeKey(header);
    return normalizedAliases.some(
      (alias) => normalizedHeader === alias || normalizedHeader.includes(alias),
    );
  });
}

function inferName(row: CsvRow): string {
  for (const [header, value] of Object.entries(row)) {
    const normalizedHeader = normalizeKey(header);
    if (normalizedHeader.includes("name") && !normalizedHeader.includes("company")) {
      return cleanText(value);
    }
  }

  return "";
}

function inferDate(row: CsvRow): string {
  for (const value of Object.values(row)) {
    const normalized = normalizeDate(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function inferStatusFromContext(row: CsvRow): AllowedCrmStatus | "" {
  const content = normalizeKey(Object.values(row).join(" "));

  if (content.includes("sale") || content.includes("closed") || content.includes("won")) {
    return "SALE_DONE";
  }

  if (content.includes("not interested") || content.includes("bad lead") || content.includes("invalid")) {
    return "BAD_LEAD";
  }

  if (content.includes("busy") || content.includes("not reachable") || content.includes("did not connect")) {
    return "DID_NOT_CONNECT";
  }

  if (content.includes("follow up") || content.includes("demo") || content.includes("callback")) {
    return "GOOD_LEAD_FOLLOW_UP";
  }

  return "";
}

function inferDataSourceFromContext(row: CsvRow): AllowedDataSource | "" {
  const content = normalizeKey(Object.values(row).join(" "));
  for (const source of ALLOWED_DATA_SOURCES) {
    if (content.includes(source.replaceAll("_", " "))) {
      return source;
    }
  }
  return "";
}

function normalizeDate(value: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return "";
  }

  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function normalizeCrmStatus(value: string): AllowedCrmStatus | "" {
  const cleaned = normalizeKey(value);
  const mapping: Record<string, AllowedCrmStatus> = {
    goodleadfollowup: "GOOD_LEAD_FOLLOW_UP",
    followup: "GOOD_LEAD_FOLLOW_UP",
    goodlead: "GOOD_LEAD_FOLLOW_UP",
    didnotconnect: "DID_NOT_CONNECT",
    didntconnect: "DID_NOT_CONNECT",
    noanswer: "DID_NOT_CONNECT",
    badlead: "BAD_LEAD",
    invalidlead: "BAD_LEAD",
    saledone: "SALE_DONE",
    closedwon: "SALE_DONE",
  };

  if (mapping[cleaned]) {
    return mapping[cleaned];
  }

  return ALLOWED_CRM_STATUSES.find((status) => normalizeKey(status) === cleaned) ?? "";
}

function normalizeDataSource(value: string): AllowedDataSource | "" {
  const cleaned = normalizeKey(value);
  if (!cleaned) {
    return "";
  }

  for (const source of ALLOWED_DATA_SOURCES) {
    if (normalizeKey(source) === cleaned || normalizeKey(source).includes(cleaned) || cleaned.includes(normalizeKey(source))) {
      return source;
    }
  }

  return "";
}

function normalizeEmail(value: string): string {
  const email = findEmails(value)[0] ?? "";
  return email.toLowerCase();
}

function normalizeCountryCode(value: string): string {
  return splitPhone(value).countryCode;
}

function normalizeMobile(value: string): string {
  return splitPhone(value).mobile;
}

function splitPhone(value: string): { countryCode: string; mobile: string } {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return { countryCode: "", mobile: "" };
  }

  const digitsOnly = cleaned.replace(/[^\d+]/g, "");
  const hasCountryPrefix = digitsOnly.startsWith("+");
  const numeric = digitsOnly.replace(/\D/g, "");
  const mobile = numeric.slice(-10);
  const countryDigits = hasCountryPrefix ? numeric.slice(0, Math.max(0, numeric.length - 10)) : "";
  const countryCode = countryDigits ? `+${countryDigits}` : "";

  return {
    countryCode: countryCode || (mobile ? "+91" : ""),
    mobile,
  };
}

function findEmails(value: string): string[] {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
}

function findPhones(value: string): string[] {
  return (value.match(/(?:\+\d{1,4}[\s-]?)?(?:\d[\s-]?){9,13}\d/g) ?? []).filter(
    isPhoneCandidate,
  );
}

function findPhonesFromRow(row: CsvRow): string[] {
  return Object.entries(row).flatMap(([header, value]) => {
    const cleanedValue = cleanText(value);
    const normalizedHeader = normalizeKey(header);

    if (!cleanedValue) {
      return [];
    }

    if (
      normalizedHeader.includes("date") ||
      normalizedHeader.includes("time") ||
      normalizedHeader.includes("created")
    ) {
      return [];
    }

    const digits = cleanedValue.replace(/\D/g, "");
    const phoneishHeader =
      normalizedHeader.includes("phone") ||
      normalizedHeader.includes("mobile") ||
      normalizedHeader.includes("contact") ||
      normalizedHeader.includes("whatsapp") ||
      normalizedHeader.includes("call") ||
      normalizedHeader.includes("tel");

    if (!phoneishHeader && normalizeDate(cleanedValue)) {
      return [];
    }

    if (digits.length < 10 || digits.length > 14) {
      return [];
    }

    return findPhones(cleanedValue);
  });
}

function isPhoneCandidate(value: string): boolean {
  const cleaned = cleanText(value);
  if (cleaned.includes(":")) {
    return false;
  }

  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 14;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanText(value: string): string {
  return value.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];
}
