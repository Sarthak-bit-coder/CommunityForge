import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/");

const STEPS = [
  {
    title: "Report",
    href: "/report",
    action: "Report a barrier",
    text: "Anyone can mark a missing curb ramp, broken surface, or blocked sidewalk. No account, no name.",
  },
  {
    title: "Verify",
    href: "/verify",
    action: "See the verification queue",
    text: "Signed-in reviewers confirm or reject each report and record why. Every decision is kept in an audit log.",
  },
  {
    title: "Plan",
    href: "/planner",
    action: "Open the repair planner",
    text: "Set a budget. The engine searches for the group of repairs that opens the most accessible routes together.",
  },
] as const;

const STATUS = [
  {
    label: "Working now",
    tone: "success",
    items: [
      "Barrier reporting, map, and matching list",
      "Reviewer sign-in with recorded verify and reject decisions",
      "Budget-limited repair planning on synthetic networks, with explanations and exports",
    ],
  },
  {
    label: "Modeled, not measured",
    tone: "warning",
    items: [
      "Every access number is an estimate from a simplified model",
      "Planner networks and costs are generated examples, not Fremont streets or dollars",
    ],
  },
  {
    label: "Not done yet",
    tone: "neutral",
    items: [
      "Fremont sidewalk network, destinations, and real repair costs",
      "Photo evidence, repair tracking, and equity-targeted planning",
      "Any agreement with the City of Fremont",
    ],
  },
] as const;

export default function OverviewPage() {
  return (
    <>
      <header className="border-b border-line pb-10">
        <p className="mb-4">
          <Badge label="Pilot in preparation · Fremont, California" tone="info" />
        </p>
        <h1 className="max-w-3xl text-4xl leading-tight font-bold tracking-tight text-ink sm:text-5xl">
          {item.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-xl text-muted">
          A sidewalk route is only as good as its worst gap. AccessForge helps a community map
          pedestrian barriers, check them, and choose the combination of repairs that opens the most
          accessible routes within a budget.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/planner"
            className="inline-flex min-h-12 items-center rounded-md bg-accent px-5 text-lg font-semibold text-surface hover:bg-ink"
          >
            Try the repair planner
          </Link>
          <Link
            href="/report"
            className="inline-flex min-h-12 items-center rounded-md border border-accent bg-surface px-5 text-lg font-semibold text-accent hover:bg-accent-soft"
          >
            Report a barrier
          </Link>
        </div>
      </header>

      <section aria-labelledby="why-heading" className="grid gap-8 py-10 lg:grid-cols-2">
        <div>
          <h2 id="why-heading" className="text-2xl font-bold text-ink">
            Why fixing the “worst” barrier first can waste the budget
          </h2>
          <p className="mt-3 text-lg text-muted">
            Picture one block between a home and a clinic with two steps in the way. Fixing either
            step alone opens nothing for someone using a wheelchair. Fixing both opens the whole
            route.
          </p>
          <p className="mt-3 text-lg text-muted">
            Lists that rank barriers one at a time cannot see that. AccessForge scores repairs as a
            group, on the network of routes they sit on.
          </p>
        </div>
        <figure className="rounded-lg border border-line bg-surface p-5">
          <ol className="space-y-4">
            {(
              [
                ["Fix one step", "✕", "✓", "Half the budget spent. Route still blocked."],
                ["Fix both steps", "✓", "✓", "Route open from home to clinic."],
              ] as const
            ).map(([label, first, second, result]) => (
              <li key={label}>
                <p className="font-semibold text-ink">{label}</p>
                <p
                  aria-hidden="true"
                  className="mt-1 flex items-center gap-2 font-mono text-lg text-ink"
                >
                  <span className="rounded bg-accent px-2 text-surface">Home</span>
                  <span className="h-0.5 flex-1 bg-ink" />
                  <span className="rounded border-2 border-ink px-2">{first}</span>
                  <span className="h-0.5 flex-1 bg-ink" />
                  <span className="rounded border-2 border-ink px-2">{second}</span>
                  <span className="h-0.5 flex-1 bg-ink" />
                  <span className="rounded bg-accent px-2 text-surface">Clinic</span>
                </p>
                <p className="mt-1 text-muted">{result}</p>
              </li>
            ))}
          </ol>
          <figcaption className="mt-4 text-sm text-muted">
            An illustration of the two-barrier example. Run it with the real engine in the{" "}
            <Link href="/planner" className="font-semibold text-accent underline">
              repair planner
            </Link>
            .
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="how-heading" className="border-t border-line py-10">
        <h2 id="how-heading" className="text-2xl font-bold text-ink">
          How it works
        </h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-lg border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-muted">Step {index + 1}</p>
              <h3 className="mt-1 text-xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-muted">{step.text}</p>
              <Link
                href={step.href}
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-4"
              >
                {step.action}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="status-heading" className="border-t border-line py-10">
        <h2 id="status-heading" className="text-2xl font-bold text-ink">
          What is real today
        </h2>
        <p className="mt-2 max-w-prose text-muted">
          AccessForge is an independent project. It is not run, endorsed, or used by the City of
          Fremont.
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {STATUS.map((group) => (
            <div key={group.label} className="rounded-lg border border-line bg-surface p-5">
              <h3>
                <Badge label={group.label} tone={group.tone} />
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
                {group.items.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6">
          <Link href="/pilot" className="font-semibold text-accent underline underline-offset-4">
            See the pilot dashboard for report counts, sources, and limits
          </Link>
        </p>
      </section>
    </>
  );
}
