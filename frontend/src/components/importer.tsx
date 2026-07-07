"use client";

import Papa from "papaparse";
import { FileSpreadsheet, LoaderCircle, Sparkles, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DataTable } from "./data-table";
import type { ImportResponse } from "@/types/crm";

type PreviewRow = Record<string, string>;
type ImportPhase = "idle" | "preview-ready" | "importing" | "done" | "error";

const CRM_COLUMNS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
];

export function Importer() {
  const [dragActive, setDragActive] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previewSummary = useMemo(() => {
    if (!file) {
      return "Upload any CSV export to generate a client-side preview before AI processing begins.";
    }

    return `${file.name} • ${previewRows.length} preview rows • ${previewHeaders.length} columns detected`;
  }, [file, previewHeaders.length, previewRows.length]);

  function resetForNewFile(nextFile: File) {
    setFile(nextFile);
    setResult(null);
    setErrorMessage("");
    setPhase("idle");
  }

  function handleFiles(files: FileList | null) {
    const nextFile = files?.[0];
    if (!nextFile) {
      return;
    }

    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Please upload a valid CSV file.");
      setPhase("error");
      return;
    }

    resetForNewFile(nextFile);

    Papa.parse<PreviewRow>(nextFile, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (parseResult) => {
        const headers =
          parseResult.meta.fields?.map((header) => header.trim()).filter(Boolean) ?? [];

        const rows = parseResult.data
          .map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()]),
            ),
          )
          .filter((row) => Object.values(row).some(Boolean))
          .slice(0, 12);

        setPreviewHeaders(headers);
        setPreviewRows(rows);
        setPhase("preview-ready");
      },
      error: (error) => {
        setErrorMessage(error.message || "Unable to preview this CSV file.");
        setPhase("error");
      },
    });
  }

  async function confirmImport() {
    if (!file) {
      return;
    }

    setPhase("importing");
    setErrorMessage("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const payload: ImportResponse | { message?: string } = await response.json();

      if (!response.ok) {
        const message = "message" in payload ? payload.message : undefined;
        throw new Error(message || "Import failed");
      }

      setResult(payload as ImportResponse);
      setPhase("done");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong during import.",
      );
      setPhase("error");
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-400/15 p-3 text-emerald-300">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Step 1. Upload CSV</h2>
              <p className="text-sm text-slate-300">
                Drag and drop a file or browse from your device.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              handleFiles(event.dataTransfer.files);
            }}
            className={`group flex min-h-64 w-full flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-6 text-center transition ${
              dragActive
                ? "border-emerald-300 bg-emerald-300/10"
                : "border-white/15 bg-slate-950/35 hover:border-emerald-300/60 hover:bg-emerald-300/5"
            }`}
          >
            <div className="rounded-full bg-white/10 p-4 text-white transition group-hover:bg-white/15">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <p className="mt-4 text-lg font-semibold text-white">
              Drop a CSV here or click to choose a file
            </p>
            <p className="mt-2 max-w-md text-sm text-slate-300">
              Supports marketing exports, CRM reports, manually prepared spreadsheets, and
              other valid CSV files.
            </p>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-400/15 p-3 text-sky-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Import flow</h2>
              <p className="text-sm text-slate-300">Preview first, then run AI extraction.</p>
            </div>
          </div>

          <ol className="mt-5 space-y-4 text-sm text-slate-200">
            <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="font-medium text-white">1.</span> Local CSV preview with zero AI calls.
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="font-medium text-white">2.</span> Confirm import only when the preview looks correct.
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="font-medium text-white">3.</span> AI maps messy columns into GrowEasy CRM fields.
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="font-medium text-white">4.</span> Review imported and skipped records in responsive tables.
            </li>
          </ol>

          <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100">
            {previewSummary}
          </div>
        </div>
      </section>

      <DataTable
        title="Step 2. CSV preview"
        subtitle="The preview is generated on the client. AI extraction has not happened yet."
        columns={previewHeaders}
        rows={previewRows}
        emptyMessage="Upload a CSV file to preview the detected rows and columns."
      />

      <section className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Step 3. Confirm import</h2>
          <p className="mt-1 text-sm text-slate-300">
            The backend is called only after confirmation.
          </p>
        </div>

        <button
          type="button"
          onClick={confirmImport}
          disabled={!file || phase === "importing" || phase === "idle" || !previewRows.length}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {phase === "importing" ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Processing import...
            </>
          ) : (
            "Confirm import"
          )}
        </button>
      </section>

      {errorMessage ? (
        <section className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {errorMessage}
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-4">
        <StatCard label="Total rows" value={result?.totalRows ?? previewRows.length} />
        <StatCard label="Imported" value={result?.importedCount ?? 0} tone="emerald" />
        <StatCard label="Skipped" value={result?.skippedCount ?? 0} tone="amber" />
        <StatCard
          label="Processor"
          value={
            result
              ? result.processing.usedFallback
                ? `${result.processing.provider} + fallback`
                : result.processing.provider
              : "waiting"
          }
          tone="sky"
        />
      </section>

      <DataTable
        title="Step 4. Parsed CRM records"
        subtitle="Structured GrowEasy CRM records returned by the backend."
        columns={CRM_COLUMNS}
        rows={result?.importedRecords ?? []}
        emptyMessage="Imported CRM records will appear here after confirmation."
        maxHeight="32rem"
      />

      <DataTable
        title="Skipped rows"
        subtitle="Rows without a valid email and mobile number are skipped automatically."
        columns={["recordId", "reason"]}
        rows={result?.skippedRecords ?? []}
        emptyMessage="Skipped rows will appear here if any records fail the minimum contact requirement."
        maxHeight="20rem"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: "slate" | "emerald" | "amber" | "sky";
}) {
  const toneClassName = {
    slate: "from-white/10 to-white/5",
    emerald: "from-emerald-400/20 to-emerald-400/5",
    amber: "from-amber-400/20 to-amber-400/5",
    sky: "from-sky-400/20 to-sky-400/5",
  }[tone];

  return (
    <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${toneClassName} p-5`}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
