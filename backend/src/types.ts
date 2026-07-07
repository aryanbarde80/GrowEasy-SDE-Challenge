export const ALLOWED_CRM_STATUSES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export const ALLOWED_DATA_SOURCES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export type AllowedCrmStatus = (typeof ALLOWED_CRM_STATUSES)[number];
export type AllowedDataSource = (typeof ALLOWED_DATA_SOURCES)[number];

export type CsvRow = Record<string, string>;

export interface ParsedCsvFile {
  headers: string[];
  rows: CsvRow[];
}

export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: AllowedCrmStatus | "";
  crm_note: string;
  data_source: AllowedDataSource | "";
  possession_time: string;
  description: string;
}

export interface ExtractionSuccess {
  action: "import";
  recordId: string;
  crmRecord: CrmRecord;
  skipReason?: never;
}

export interface ExtractionSkipped {
  action: "skip";
  recordId: string;
  crmRecord?: never;
  skipReason: string;
}

export type ExtractionResult = ExtractionSuccess | ExtractionSkipped;

export interface ImportResponse {
  fileName: string;
  headers: string[];
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  importedRecords: CrmRecord[];
  skippedRecords: Array<{
    recordId: string;
    reason: string;
  }>;
  processing: {
    provider: "groq" | "heuristic";
    usedFallback: boolean;
    batchSize: number;
    failedBatchRetries: number;
  };
}
