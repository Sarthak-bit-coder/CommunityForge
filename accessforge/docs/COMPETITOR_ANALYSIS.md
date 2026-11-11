# Competitor and Prior-Work Analysis

Status: Phase 0 research. Last researched: 2026-11-12.

## How to read this document

Each claim carries one of these evidence tags:

| Tag | Meaning |
|---|---|
| **[V]** | Verified this session against the linked primary source (project site, paper, API response). |
| **[S]** | Seen only in a search-engine summary or secondary coverage; the primary page was not read in full. Treat as likely but re-check before citing externally. |
| **[U]** | Unverified or not found. Listed as an evidence gap, never as a fact. |

Nothing here comes from interviews, partnerships, or our own measurements. We have none yet.

---

## 1. Project Sidewalk (University of Washington Makeability Lab)

### What it is
- An open-source web tool where remote volunteers and paid crowdworkers label sidewalk accessibility features and barriers by walking through Google Street View imagery. Label types include curb ramps, missing curb ramps, obstacles, surface problems, and missing sidewalks, each with a severity rating. **[V]** ([CHI 2019 paper](https://makeabilitylab.cs.washington.edu/media/publications/Saha_ProjectSidewalkAWebBasedCrowdsourcingToolForCollectingSidewalkAccessibilityDataAtScale_CHI2019.pdf), DOI 10.1145/3290605.3300292)
- The CHI 2019 paper reports an 18-month Washington, DC deployment: 797 online users, 205,385 labels, and 2,941 miles of streets audited. **[S]** (search summary of the paper; the figures match the abstract)
- Contributors validate each other's labels. The project says validation is now AI-assisted, and its Overall Stats API separates human votes from AI votes. **[S]** ([Project Sidewalk about page](https://sidewalk-cdmx.cs.washington.edu/about), [API docs](https://sidewalk-chicago.cs.washington.edu/v3/api-docs/overall-stats))
- Data is open. It can be downloaded as CSV, GeoJSON, or shapefile, or pulled through a public API with label, validation, street, and "AccessScore" endpoints. **[S]** ([API docs](https://sidewalk-cdmx.cs.washington.edu/api))
- **AccessScore**: a neighborhood score in (0, 1). The project's own docs call it experimental and say the weights may change. It grew out of Li et al., ASSETS 2018, which scored grid cells by routing to nearby points of interest and penalizing labeled barriers. **[S]** ([ASSETS 2018 poster](https://makeabilitylab.cs.washington.edu/media/publications/Li_InteractivelyModelingAndVisualizingNeighborhoodAccessibilityAtScaleAnInitialStudyOfWashingtonDc_ASSETS2018.pdf), [AccessScore API doc](https://sidewalk-spgg.cs.washington.edu/v3/api-docs/accessScoreRegions))
- Data quality: Askari et al. (2025, *Urban Science* 9(4):130) compared Project Sidewalk audits with government field data in Seattle and DuPage County, IL. Agreement ranged from 75% for pedestrian signals to 100% for missing sidewalks. Severity ratings were harder to compare. **[V]** ([NSF PAR record](https://par.nsf.gov/biblio/10644331-validating-pedestrian-infrastructure-data-how-well-do-street-view-imagery-audits-compare-government-field-data))
- Computer vision: a 2024 ASSETS paper benchmarks deep learning on 33 sidewalk-condition classes and releases an open dataset. **[S]** ([Liu et al. ASSETS 2024](https://makeabilitylab.cs.washington.edu/media/publications/Liu_TowardsFineGrainedSidewalkAccessibilityAssessmentWithDeepLearningInitialBenchmarksAndAnOpenDataset_ASSETS2024.pdf))

### Deployment footprint (relevant to Fremont)
- The Cities API returned 60 entries on 2026-11-12, some of them study or legacy instances. **The only California deployment was Los Angeles. There was no Fremont, Oakland, or San Jose deployment.** **[V]** ([Cities API](https://sidewalk-chicago.cs.washington.edu/v3/api/cities))

### Takeaway
Project Sidewalk is the strongest open source of barrier data and has a validated pipeline for collecting it. **We should not compete with it on data collection.** We should consume its data model and API format, and consider asking for a Fremont deployment rather than rebuilding a labeling tool.

---

## 2. AccessMap / OpenSidewalks (UW Taskar Center for Accessible Technology)

### What it is
- AccessMap is a web routing app, launched in Seattle in 2017. It plans pedestrian routes from a user's mobility profile, taking into account slope, curb ramps, and construction closures. **[S]** ([UW News 2017](https://www.washington.edu/news/2017/02/01/new-route-finding-map-lets-seattle-pedestrians-avoid-hills-construction-accessibility-barriers/))
- OpenSidewalks is a data schema built on OpenStreetMap conventions. It models sidewalks, crossings, and curb ramps as a routable network. **[S]** ([Urban@UW 2020](https://urbanalytics.uw.edu/news/2020/11/10/open-sidewalks), [OSM wiki](https://wiki.openstreetmap.org/wiki/Taskar_Center_for_Accessible_Technology))
- AccessMap has expanded to Seattle, Bellingham, and Mount Vernon, WA. Washington State commissioned a statewide dataset (OS-CONNECT) built on the OpenSidewalks model. **[S]** ([Urban@UW](https://urban.uw.edu/news/accessible-pedestrian-routing-tools-expand-to-three-washington-cities))
- Research basis: Bolten & Caspi (2021), "Towards routine, city-scale accessibility metrics: Graph theoretic interpretations of pedestrian access using personalized pedestrian network analysis," *PLOS ONE*, DOI 10.1371/journal.pone.0248399. It introduces **Personalized Pedestrian Network Analysis (PPNA)**, which uses weighted graphs per pedestrian profile. It shows that betweenness-centrality rankings disagree across profiles and proposes **normalized sidewalk reach** as a metric. The paper says its data and software are public on GitHub. **[S]** ([PMC7978374](https://pmc.ncbi.nlm.nih.gov/articles/PMC7978374/); the page served a CAPTCHA when fetched, so this is from the search abstract)
- The Taskar Center appears in USDOT ITS4US materials. **[S]** ([ITS4US webinar PDF](https://its.dot.gov/its4us/pdf/USDOT_ITS4US_UW_Webinar.pdf))

### Takeaway
PPNA already establishes **profile-specific weighted graphs and reach metrics**. Those are the foundation of our engine, and **they are not our contribution.** We should adopt the OpenSidewalks schema where practical and cite PPNA as the basis for our accessibility metric.

---

## 3. AccessNow

### What it is
- A consumer map and app for **places** such as restaurants, hotels, shops, transit, and parks. Places carry color-coded pins (accessible, partially accessible, not accessible), crowdsourced reviews, and feature tags. **[V]** ([accessnow.com](https://accessnow.com/)) **[S]** ([review how-to](https://accessnow.com/blog/how-to-add-a-review-on-accessnow/))
- It runs community "MapMission" events plus programs named AccessNow Verified, AccessStudio, AccessOutdoors, and AccessFest. The homepage gives few details about them. **[V]** (names only)
- A syndicated CNET article claims coverage of 2M+ locations in 35+ countries, AI used to "interpret and predict" accessibility features, and a paid tier of $12–17/month. **[U]**: the article URL returned 404 when fetched. Do not repeat these figures.
- We found no evidence of sidewalk-network data, routing, or municipal capital-planning features. **[U]**: absence in what we read is not proof of absence.

### Takeaway
AccessNow covers **destination (venue) accessibility**, not the public right-of-way. It complements our work more than it competes with it. Venue entrance accessibility could later inform the weights on our destination nodes.

---

## 4. Commercial sidewalk assessment vendors (not in the original brief, but direct overlap)

- **DeepWalk**: iPhone-LiDAR sidewalk and curb-ramp inspection with GIS output. Case studies say its results feed improvement programs such as hazard removal. **[S]** ([Danville, IL case study](https://www.casestudies.com/company/deepwalk/case-study/danville-prioritizes-sidewalk-access))
- **Daxbot**: robot-collected sidewalk and curb-ramp inventories checked against PROWAG. **[S]** ([daxbot.com](https://daxbot.com/sidewalk-assessments/solutions))
- **Georgia DOT** funded an automated sidewalk quality and safety assessment system that supports repair prioritization. **[S]** ([ROSA P record](https://rosap.ntl.bts.gov/view/dot/29715/dot_29715_DS1.pdf))
- How these vendors actually prioritize repairs (per-defect scoring or network-aware) is **[U]**. This is the most important open question about competitors (see §8).

---

## 5. Municipal practice (how cities prioritize today)

- **Seattle** ranks repairs by mobility impact, risk, cost, and usage, with geographic and social-justice distribution, to get the best value from a limited budget. **[S]** (search summary of [SDOT](https://www.seattle.gov/transportation/projects-and-programs/programs/pedestrian-program/sidewalk-accessibility-guide); our direct fetch did not reach the relevant text)
- **Los Angeles**: the City Controller's audit found that the Sidewalk Repair Program's prioritization lacked citywide condition data. **[S]** ([LA Controller audit](https://controller.lacity.gov/audits/sidewalks))
- **Denver** scores projects on condition, safety, accessibility, and connectivity. **[S]** (neighborhood newsletter, low authority)
- **Fremont, CA**:
  - Adopted a Pedestrian Master Plan on 2016-12-13 and replaced it with an **Active Transportation Plan in May 2025**. **[S]** ([Pedestrian Master Plan](https://fremont.gov/government/departments/transportation-engineering/walking-bicycling/pedestrian-master-plan), [ATP](https://www.fremont.gov/government/departments/transportation-engineering/walking-bicycling/active-transportation-plan))
  - Runs an annual Concrete & Intersection Ramp Program. One cycle lists 211 ramps at 104 locations, another 291 ramps at 142 locations. **[S]** ([completed projects](https://fremont.gov/government/departments/public-works/public-works-projects/completed-public-works-projects))
  - Has an open data portal and eGIS map. **We did not find a public sidewalk-condition or curb-ramp inventory layer.** **[U]**
  - We did not locate Fremont's ADA self-evaluation or public right-of-way transition plan. **[U]**

**Pattern:** the municipal methods we saw score **each defect or project on its own merits**, using attributes such as proximity, usage, and risk. Whether they model **network effects** (a repair that is only useful once a second barrier on the same path is also fixed) is not stated in what we read. **[U]**

---

## 6. Academic work on optimization

| Work | Relevance | Tag |
|---|---|---|
| Bolten & Caspi 2021, PLOS ONE (PPNA) | Profile-specific weighted pedestrian graphs and reach metrics | [S] |
| *Building non-motorized accessible communities for heterogeneous demand: A facility location and network design problem*, PLOS ONE 2024, DOI 10.1371/journal.pone.0312230 | **Closest prior work.** Chooses facility locations and road segments to make accessible, for users with different walking abilities, under optimization. Uses a randomized greedy heuristic (per search summary). Authors and exact formulation not yet confirmed because PMC served a CAPTCHA. | [S] |
| Dilkina, Lai & Gomes, "Upgrading Shortest Paths in Networks," CPAIOR 2011 ([PDF](https://www.cs.cornell.edu/~bistra/papers/DilkinaCPAIOR2011_upgradingshortestpaths.pdf)) | Budgeted edge upgrades to shorten paths. The search summary says the objective is **not submodular** and naive greedy can fail, while an iterative greedy variant performs well. This is exactly the complementarity issue we expect. | [S] (authors inferred from repository path and venue; confirm) |
| Khuller, Moss & Naor 1999 (budgeted maximum coverage); Krause & Guestrin 2005 (budgeted submodular maximization) | Cost-benefit greedy plus best-single-item gives constant-factor guarantees **only if** the objective is submodular | Standard references, not fetched this session |
| Li et al., "Accessibility for Whom?", CHI 2025 ([arXiv 2502.19888](https://arxiv.org/abs/2502.19888)) | Online survey (N=190) of five mobility-aid groups rating 52 barrier images. Perceptions **differ by group**, with some shared concerns. Supports profile-specific barrier costs. | [V] (abstract) |
| Hosseini et al. 2023, Tile2Net, *CEUS* 101, DOI 10.1016/j.compenvurbsys.2023.101950 | Open-source extraction of sidewalk polygons and network centerlines from aerial imagery. A possible source for Fremont's sidewalk network geometry. | [S] |

---

