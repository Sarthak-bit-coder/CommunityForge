import { SOURCE_LABELS, type EvidenceProvenance } from "@/lib/barriers";

export function EvidenceProvenanceList({
  evidence,
}: {
  readonly evidence: readonly EvidenceProvenance[];
}) {
  return (
    <div className="mt-3 text-sm wrap-anywhere text-ink">
      <p className="font-semibold">Evidence provenance</p>
      {evidence.length ? (
        <ul className="mt-1 space-y-3" aria-label="Evidence provenance">
          {evidence.map((record, index) => (
            <li key={`${record.source_ref}-${index}`}>
              <dl>
                <dt className="font-semibold">Source</dt>
                <dd>{SOURCE_LABELS[record.source]}</dd>
                <dt className="font-semibold">Source reference</dt>
                <dd>{record.source_ref}</dd>
                <dt className="font-semibold">Source version</dt>
                <dd>{record.source_version ?? "Not supplied"}</dd>
                <dt className="font-semibold">Observed</dt>
                <dd>
                  <time dateTime={record.observed_at}>{record.observed_at}</time>
                </dd>
                <dt className="font-semibold">Recorded</dt>
                <dd>
                  <time dateTime={record.recorded_at}>{record.recorded_at}</time>
                </dd>
              </dl>
              {record.source === "community_report" ? (
                <p>Observation time records submission receipt, not a verified site visit.</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No evidence provenance was supplied.</p>
      )}
    </div>
  );
}
