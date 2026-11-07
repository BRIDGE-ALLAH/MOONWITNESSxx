# 06 — Product Factories & Production Strategy

**Status:** Approved baseline  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Shared production contract

Every product family follows:

Opportunity → Product Brief → Rights/Policy Preflight → Production → Technical QA → Creative QA → Metadata → Package → Channel Readiness → Publication → Performance → Maintenance / Retirement.

A production job must have:
- Product ID and version.
- Opportunity/evidence reference.
- Intended buyer and job.
- Channel and format requirements.
- Creative brief.
- Source assets and licenses.
- AI tools/models and relevant generation records.
- Output files and checksums.
- Metadata and disclosures.
- QA findings.
- Final owner decision or authorized action.
- Changelog and provenance.

## 2. Factory portfolio

### 2.1 Digital Utility Factory — P1
Original spreadsheets, planners, calculators, Notion/workspace templates, checklists, dashboards, printable utilities, and structured packs.

Quality requirements:
- Real functional test cases.
- Clear instructions and compatibility.
- Example data separated from blank template.
- Honest preview of actual contents.
- No fake claims or hidden dependencies.
- Localization checked for units, dates, currency, and language.

### 2.2 Stock Asset Factory — P1
Original illustrations, vectors, backgrounds, textures, motion graphics, and video assets.

Quality requirements:
- Visual uniqueness and professional finish.
- Composition, artifacts, anatomy, text, and geometry inspection as relevant.
- Rights and model/tool terms recorded.
- AI disclosure and labeling when the agency requires it.
- Metadata must describe the asset accurately.
- Duplicate and near-duplicate detection.
- Correct formats, dimensions, color profile, and file integrity.

### 2.3 Affiliate Media Factory — P2
Original product explainers, truthful demonstrations, setup tutorials, comparisons, and short-form content for eligible affiliate programs.

Quality requirements:
- Accurate product facts from reliable sources.
- Clear material-connection/affiliate disclosure.
- No fake hands-on claims.
- Do not fabricate product functionality or test results.
- Use original or licensed media.
- Track product availability and link validity.
- Respect platform disclosure and branded-content rules.

### 2.4 Publishing Factory — P2
Original ebooks, workbooks, practical guides, learning materials, and reference products.

Quality requirements:
- Editorial review, factual verification, citations, and rights checks.
- Human responsibility for usefulness and correctness.
- AI-generated content disclosed where required by publisher policy.
- No thin, repetitive, misleading, or plagiarized books.
- Validate formatting, navigation, cover, metadata, and preview.

### 2.5 Workflow Product Factory — P3
Original automation templates, n8n workflows, ComfyUI workflows, scripts, presets, developer utilities, and configuration packs.

Quality requirements:
- Reproducible setup instructions.
- Version and dependency manifest.
- License and third-party dependency review.
- Safe defaults; no embedded secrets.
- Tested import/export.
- Compatibility matrix.
- Clear maintenance state.

Do not redistribute a platform or dependency in a way that violates its license. n8n's Sustainable Use License and commercial embedding rules must be checked before any product embeds, white-labels, or resells n8n functionality.

### 2.6 Media Factory — P3
Original tutorial, documentary-style explainer, educational media, animation, and story-led video.

Quality requirements:
- Original point of view and structure.
- Meaningful editorial input.
- Fact checking.
- Rights-cleared visuals, music, and sound.
- No mass-produced repetitive uploads.
- Clear distinction between fictional/synthetic visuals and real footage where relevant.
- Preserve project files and source records.

### 2.7 Game Asset Factory — P4
Original 2D/3D assets, icons, UI kits, sprites, VFX, SFX, textures, and models for creator/game marketplaces.

Quality requirements:
- File and engine compatibility.
- Scale, naming, rigging, texture, and performance checks.
- License and dependencies.
- Preview scenes and reproducible installation.
- No copied IP, trademark, or prohibited user-generated content.

### 2.8 Microgame Factory — P4
Small games, interactive learning products, browser games, and platform-native experiences.

Quality requirements:
- Playability and device testing.
- Clear tutorial and controls.
- Performance and accessibility.
- Monetization disclosure and platform compliance.
- Retention and player-safety considerations.
- No fake visits or template-game abuse.

## 3. Product family strategy

Build a coherent family around a validated buyer job. Example: a small-business inventory problem could produce:
- A functional inventory spreadsheet.
- A localized variant.
- A quick-start guide.
- A short tutorial.
- A matching stock illustration set.

Each output must stand alone as useful work. No thin duplication or keyword-stuffed bundles.

## 4. Living Product lifecycle

Products can move through:
- Draft.
- In Production.
- QA.
- Ready.
- Published.
- Needs Update.
- Paused.
- Archived.
- Retired.

For maintainable products, store:
- Semantic version.
- Change notes.
- Compatibility.
- Known issues.
- Previous files.
- User-facing update notes.
- Channel update status.

## 5. Creative reuse rules

Reuse source assets only when:
- Ownership/license permits the derivative.
- The destination marketplace allows the use.
- The new product adds real value.
- Metadata accurately explains the result.
- Similarity and duplicate rules are respected.

Never upload near-identical assets merely to occupy search results.

## 6. Packaging standards

A product package may include:
- Final deliverable.
- Preview images/screenshots.
- Readme or quick-start guide.
- License and permitted-use summary.
- Version and compatibility details.
- Support boundary.
- Source/provenance manifest retained internally.
- Marketplace-specific metadata and disclosure.

## 7. Rejection and recovery

If QA fails:
1. Keep the failed artifact and report.
2. Categorize defect.
3. Decide fix, regenerate, or retire.
4. Do not silently overwrite approved versions.
5. Re-run affected inspections.
6. Preserve history and final decision.
