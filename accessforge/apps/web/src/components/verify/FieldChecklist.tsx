import { BARRIER_TYPE_LABELS, type Barrier } from "@/lib/barriers";

export type FieldVisit = Pick<Barrier, "id" | "type" | "location">;

export function FieldChecklist({
  visits,
  remove,
}: {
  visits: readonly FieldVisit[];
  remove: (id: string) => void;
}) {
  return (
    <section
      aria-labelledby="field-checklist"
      className="my-4 space-y-3 rounded-lg border border-line bg-surface p-4"
    >
      <h2 id="field-checklist" className="af-h2">
        Field visit checklist
      </h2>
      {visits.length ? (
        <>
          <p>Visit these locations and record your observations in the verification queue.</p>
          <ol className="list-decimal space-y-2 pl-6">
            {visits.map(({ id, type, location }) => (
              <li key={id} className="break-inside-avoid">
                <span className="font-medium">{BARRIER_TYPE_LABELS[type]}</span> · {location.lat},{" "}
                {location.lng}
                <br />
                <span className="break-all">Report {id}</span>{" "}
                <button
                  className="af-link min-h-11 print:hidden"
                  type="button"
                  aria-label={`Remove report ${id} from checklist`}
                  onClick={() => remove(id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="af-button-secondary print:hidden"
            onClick={() => window.print()}
          >
            Print field checklist
          </button>
        </>
      ) : (
        <p>Select a pending report and add it to your checklist.</p>
      )}
    </section>
  );
}
