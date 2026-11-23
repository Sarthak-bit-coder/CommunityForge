import { HeroGlow } from "@/components/home/HeroGlow";
import { HeroRoute } from "@/components/home/HeroRoute";
import { BarrierBreakHeading } from "@/components/home/BarrierBreakHeading";
import { HomeMapPreview } from "@/components/home/HomeMapPreview";
import { RepairStory } from "@/components/home/RepairStory";
import { RouteCompare } from "@/components/home/RouteCompare";
import { StatusMark, StatusStamp } from "@/components/home/StatusStamp";
import { StepTitle } from "@/components/home/StepTitle";
import { MotionLink } from "@/components/motion/MotionLink";
import { MOTION_STAGGER_S } from "@/components/motion/motion-tokens";
import { Reveal } from "@/components/motion/Reveal";
import { ScrollSkew } from "@/components/motion/ScrollSkew";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { Badge } from "@/components/ui/Badge";
import { preconnect } from "react-dom";
import { basemap } from "@/lib/basemap";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/");
const ROUTE_WORD = "reconnect";

// The headline reads as plain text to assistive tech; the drawn route is decorative.
function HeroHeading({ text }: { readonly text: string }) {
  const index = text.indexOf(ROUTE_WORD);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <span className="relative inline-block">
        {ROUTE_WORD}
        <HeroRoute />
      </span>
      {text.slice(index + ROUTE_WORD.length)}
    </>
  );
}

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
    label: "Ready to use",
    tone: "success",
    items: [
      "Report barriers on a live map with a matching accessible list",
      "Reviewer sign-in with every verify and reject decision recorded",
      "Budget-limited repair planning with explanations and exports",
    ],
  },
  {
    label: "Modeled estimates",
    tone: "modeled",
    items: [
      "Every access number is an estimate from a transparent model",
      "Planner networks and costs are illustrative examples, not Fremont streets or dollars",
    ],
  },
] as const;

// The three kinds of information on this site, in the same tones every page uses.
const EVIDENCE_KINDS = [
  {
    label: "Verified",
    tone: "success",
    text: "A trained reviewer checked the report and confirmed it.",
  },
  {
    label: "Unverified",
    tone: "warning",
    text: "Reported by the community or mapped in OpenStreetMap, not yet checked.",
  },
  {
    label: "Modeled estimate",
    tone: "modeled",
    text: "Calculated by the AccessForge engine. A projection, not a measurement.",
  },
] as const;

function EvidenceKey() {
  return (
    <section
      aria-labelledby="evidence-heading"
      className="af-rise mt-16 rounded-2xl border border-line bg-surface/70 p-5 [animation-delay:320ms] sm:p-6"
    >
      <h2 id="evidence-heading" className="text-sm font-bold text-ink">
        How to read what you see
      </h2>
      <dl className="mt-4 grid gap-5 sm:grid-cols-3">
        {EVIDENCE_KINDS.map((kind) => (
          <div key={kind.label} className="flex flex-col gap-2">
            <dt>
              <Badge label={kind.label} tone={kind.tone} />
            </dt>
            <dd className="text-sm leading-relaxed text-muted">{kind.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const ROUTING_POINTS = [
  "Current routes come from the mapped street network in the pilot area.",
  "Modeled routes show what a recommended repair would open. They are estimates.",
  "AccessForge does not give directions and cannot say whether a path is safe.",
] as const;

const BUDGET_POINTS = [
  "Repairs are chosen as a group within the budget, because a repair can matter more alongside others.",
  "Each recommendation carries its explanation, so a planner can see why it was chosen.",
  "Costs in the planner are generated examples until real Fremont estimates exist.",
] as const;

// The hero map's tiles come from here; connecting during HTML parse saves a round trip later.
const TILE_ORIGIN = new URL(basemap(process.env.NEXT_PUBLIC_MAPTILER_KEY).styleUrl).origin;

export default function OverviewPage() {
  preconnect(TILE_ORIGIN, { crossOrigin: "anonymous" });
  return (
    // data-page opts the Overview out of the lively text styles in globals.css.
    <div data-page="overview" className="flex flex-col">
      <ScrollProgress />

      <section
        aria-labelledby="home-heading"
        className="relative isolate pt-6 pb-20 lg:pt-12 lg:pb-28"
      >
        <HeroGlow />
        <div className="mx-auto grid max-w-5xl items-center gap-14 lg:max-w-none lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-16">
          {/* CSS entrance, not JS: the hero must paint before hydration (LCP, no-JS). */}
          {/* Top padding = map panel border + padding, so the eyebrow lines up with the map's top edge. */}
          <div className="lg:pt-[17px]">
            <p className="af-eyebrow af-rise">Fremont pilot · Pedestrian access</p>
            <h1
              id="home-heading"
              className="af-display af-rise mt-6 text-[2.75rem] leading-[1] [animation-delay:80ms] sm:text-6xl lg:text-[4.75rem]"
            >
              <HeroHeading text={item.heading ?? item.label} />
            </h1>
            <p className="af-rise mt-7 max-w-prose text-lg leading-relaxed text-muted [animation-delay:160ms] sm:text-xl">
              AccessForge helps planners see which sidewalk repairs would reconnect the most routes,
              and checks whether repairs worked. It is a research pilot, not an official inspection
              tool.
            </p>
            <div className="af-rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:240ms]">
              <MotionLink href="/report" className="af-button-primary">
                Report a barrier
              </MotionLink>
              <MotionLink href="/planner" className="af-button-secondary">
                Open the repair planner
              </MotionLink>
            </div>
          </div>
          <div className="af-rise relative [animation-delay:200ms]">
            <span
              aria-hidden="true"
              className="absolute -inset-3 -z-10 rounded-[1.75rem] bg-[repeating-linear-gradient(135deg,var(--color-line)_0_1px,transparent_1px_10px)]"
            />
            <div className="af-panel p-3 shadow-lift sm:p-4">
              <HomeMapPreview />
            </div>
          </div>
        </div>
        <EvidenceKey />
      </section>

      <section aria-labelledby="story-heading" className="border-t border-line py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="af-eyebrow">Why repairs are planned as a group</p>
            <ScrollSkew>
              <h2 id="story-heading" className="af-display mt-4 max-w-3xl text-4xl sm:text-5xl">
                One ramp can open nothing. The right pair can open the whole trip.
              </h2>
            </ScrollSkew>
          </Reveal>
          <div className="mt-12">
            <RepairStory />
          </div>
          <ul className="mt-10 grid gap-3 text-sm leading-relaxed text-muted sm:grid-cols-2">
            {BUDGET_POINTS.slice(1).map((point) => (
              <li key={point} className="border-l-2 border-marker pl-4">
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="border-t border-line py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <ScrollSkew>
            <BarrierBreakHeading
              id="steps-heading"
              before="From a reported barrier"
              after="to a funded repair"
              className="af-display text-4xl sm:text-5xl"
            />
          </ScrollSkew>
          <ol className="mt-16 flex flex-col gap-20">
            {STEPS.map((step, index) => (
              <li key={step.href}>
                <Reveal>
                  <article
                    className={`grid items-start gap-6 md:grid-cols-[auto_1fr] md:gap-14 ${
                      index % 2 === 1 ? "md:[&>p]:order-2" : ""
                    }`}
                  >
                    <p
                      aria-hidden="true"
                      className="af-display text-7xl leading-none text-accent sm:text-8xl"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <div className="flex max-w-xl flex-col gap-4">
                      <StepTitle text={step.title} className="af-display text-3xl" />
                      <p className="text-lg leading-relaxed text-muted">{step.text}</p>
                      <MotionLink href={step.href} className="af-link">
                        {step.action}
                      </MotionLink>
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="routing-heading"
        className="rounded-3xl bg-ink px-6 py-16 text-surface sm:px-12 lg:py-20"
      >
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1fr_1fr] md:gap-16">
          <Reveal>
            <p className="af-eyebrow text-accent-soft">Accessible routing</p>
            <ScrollSkew>
              <h2
                id="routing-heading"
                className="af-display mt-4 text-4xl text-surface sm:text-5xl"
              >
                See the route as it is, then as it could be
              </h2>
            </ScrollSkew>
            <ul className="mt-8 grid gap-3 text-base leading-relaxed text-surface/80">
              {ROUTING_POINTS.map((point) => (
                <li key={point} className="border-l-2 border-marker pl-4">
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <RouteCompare />
        </div>
      </section>

      {/* A ledger, not a card grid: one ruled row per status, read top to bottom. */}
      <section aria-labelledby="status-heading" className="pt-24 pb-16 lg:pt-28 lg:pb-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <ScrollSkew>
              <h2 id="status-heading" className="af-display max-w-3xl text-4xl sm:text-5xl">
                What AccessForge does
              </h2>
            </ScrollSkew>
          </Reveal>
          <dl className="mt-12 border-t-2 border-ink">
            {STATUS.map((group, index) => (
              // Reveal renders the row's own <div>, so the list keeps valid dl > div > dt/dd nesting.
              <Reveal
                key={group.label}
                delay={index * MOTION_STAGGER_S}
                className="grid gap-4 border-b border-line py-8 md:grid-cols-[14rem_1fr] md:gap-10"
              >
                <dt className="flex items-baseline gap-4 pt-0.5">
                  <span
                    aria-hidden="true"
                    className="font-display text-sm font-semibold text-muted tabular-nums"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <StatusStamp>
                    <Badge label={group.label} tone={group.tone} />
                  </StatusStamp>
                </dt>
                <dd>
                  <ul className="grid gap-x-10 gap-y-3 text-base leading-relaxed text-ink sm:grid-cols-2">
                    {group.items.map((text, itemIndex) => (
                      <li key={text} className="flex gap-3">
                        {/* A shape as well as a colour; decorative, the badge text carries the meaning. */}
                        <StatusMark tone={group.tone} index={itemIndex} />
                        {text}
                      </li>
                    ))}
                  </ul>
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
