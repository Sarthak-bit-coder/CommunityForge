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

