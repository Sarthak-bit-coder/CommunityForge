"use client";

import { useEffect, useState } from "react";
import { verificationDisplay } from "@/lib/barriers";
import { fetchReport, reportStatusLabel } from "@/lib/reports-api";

type Result = { status: string; explanation: string } | { error: string };

export function ReportTracking({ id }: { readonly id: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetchReport(id, controller.signal);
        if (controller.signal.aborted) return;
        if (response?.data?.id !== id) throw new Error("Could not confirm this report’s status.");
        const { state } = response.data;
        setResult({
          status: reportStatusLabel(state),
          explanation: verificationDisplay(state).explanation,
        });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            error: error instanceof Error ? error.message : "Could not load this report.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [id, attempt]);

  return (
    <section
      aria-label="Report tracking"
      className="space-y-3 rounded-lg border border-line bg-surface p-4"
    >
      <p className="text-sm text-muted">
        Report ID: <span className="break-all">{id}</span>
      </p>
      <div role="status">
        {!result ? (
          <p>Loading report status…</p>
        ) : "status" in result ? (
          <>
            <h2 className="text-lg font-semibold">{result.status}</h2>
            <p>{result.explanation}</p>
          </>
        ) : null}
      </div>
      {result && "error" in result ? <p role="alert">{result.error}</p> : null}
      <button
        type="button"
        disabled={!result}
        className="af-button-secondary min-h-11"
        onClick={() => {
          setResult(null);
          setAttempt((value) => value + 1);
        }}
      >
        {result && "error" in result ? "Retry" : "Refresh status"}
      </button>
    </section>
  );
}
