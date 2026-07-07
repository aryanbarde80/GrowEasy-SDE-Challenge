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
  crm_status: string;
  crm_note: string;
  data_source: string;
  possession_time: string;
  description: string;
}

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
    provider: "openai" | "heuristic";
    usedFallback: boolean;
    batchSize: number;
    failedBatchRetries: number;
  };
}
