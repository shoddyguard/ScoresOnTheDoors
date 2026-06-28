"use client";

import { useRef, useState, useTransition } from "react";
import { importPredictions } from "@/app/actions/admin";
import type { ImportSummary } from "@/lib/services/csvImportService";

const TEMPLATE_HEADER = "username,home_team,away_team,date,home_goals,away_goals,advancing_team";
const TEMPLATE_ROWS = [
  "alice,Mexico,South Africa,2026-06-11,2,0,",
  "bob,USA,England,2026-06-17,1,2,",
  "charlie,Brazil,Argentina,2026-07-02,1,1,Brazil",
];
const TEMPLATE_CSV = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].join("\n");

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "predictions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a CSV file first.");
      return;
    }
    setError(null);
    setSummary(null);

    startTransition(async () => {
      try {
        const text = await file.text();
        const result = await importPredictions(text);
        setSummary(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-white file:text-sm file:cursor-pointer hover:file:bg-gray-50"
        />
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Importing…" : "Import predictions"}
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          className="btn-secondary text-sm"
        >
          Download template CSV
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span className="text-green-700 font-medium">
              {summary.imported} imported
            </span>
            {summary.skipped > 0 && (
              <span className="text-amber-700 font-medium">
                {summary.skipped} skipped
              </span>
            )}
            <span className="text-gray-500">{summary.total} rows total</span>
          </div>

          {summary.errors.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800 mb-2">
                Errors ({summary.errors.length})
              </p>
              {summary.errors.map((err, i) => (
                <p key={i} className="text-xs text-amber-900 font-mono">
                  {err.row === 0 ? "Header" : `Row ${err.row}`}: {err.message}
                </p>
              ))}
            </div>
          )}

          {summary.imported > 0 && summary.errors.length === 0 && (
            <p className="text-sm text-green-700">All rows imported successfully.</p>
          )}
        </div>
      )}
    </div>
  );
}
