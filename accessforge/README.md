# AccessForge AI

AccessForge AI is an accessibility infrastructure intelligence platform. It helps communities find pedestrian accessibility barriers, understand how those barriers cut people off from essential destinations, choose which repairs to fund under a limited budget, and verify that repairs actually happened.

**Initial target:** Fremont, California (one pilot area). **Long-term goal:** a deployment playbook other communities can reuse.

> AccessForge outputs are planning estimates. They are **not** official accessibility inspections, ADA compliance determinations, or safe-route guarantees.

## Current status: Phase 0 complete (research and documentation only)

- No application code exists yet.
- No user interviews, partnerships, or measured results exist yet. Every claim about users and outcomes in the docs is labeled as an assumption or a proposal.

## The core idea

Tools such as Project Sidewalk (barrier data) and AccessMap (personalized routing) already answer *where the barriers are* and *how to route around them*. AccessForge aims at a different question:

> **Given a budget, which *set* of repairs most improves access to essential destinations, for which people, and how sure are we?**

The proposed **Accessibility Impact Optimization Engine** models the pedestrian network as a profile-specific weighted graph. It accounts for **complementary repairs** (two fixes that are only useful together), for **uncertainty** about whether reported barriers really exist, and for **equity** across groups. It explains each recommendation and is benchmarked against simpler per-defect ranking. The primary hypothesis is falsifiable and pre-registered. See [docs/RESEARCH_HYPOTHESIS.md](docs/RESEARCH_HYPOTHESIS.md).

## Documents

| Doc | Contents |
|---|---|
| [docs/COMPETITOR_ANALYSIS.md](docs/COMPETITOR_ANALYSIS.md) | Project Sidewalk, AccessMap/OpenSidewalks, AccessNow, vendors, academic work, evidence gaps |
| [docs/RESEARCH_HYPOTHESIS.md](docs/RESEARCH_HYPOTHESIS.md) | Model, hypotheses H1–H4, algorithms, baselines, metrics, limitations |
| [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Users, use cases, MVP scope and exclusions, accessibility, privacy, verification |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, engine contract, data flow, API, deployment, security |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases with acceptance criteria |
| [docs/AGENT_OWNERSHIP.md](docs/AGENT_OWNERSHIP.md) | Claude Code vs. Codex file ownership |
| [AGENTS.md](AGENTS.md) | Repository conventions and testing requirements |

