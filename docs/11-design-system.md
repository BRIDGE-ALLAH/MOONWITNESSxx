# 11 — Design System Specification

**Status:** Approved foundation for prototype  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Design system objectives

- Memorable RIOTWORKS visual identity.
- Consistent dark and light themes.
- High usability for dense business operations.
- Reusable, composable React components.
- Accessible interaction and responsive behavior.
- Original graphic assets and character integration.
- No accidental drift into generic SaaS UI.

## 2. Token layers

### Primitive colors
Use the palette in docs/10-design-dna.md.

### Semantic colors
Define independent tokens for:
- success
- warning
- danger
- info
- neutral
- focus
- selected
- disabled

Never encode meaning through color alone. Pair with text, iconography, or shape.

### Surface layers
- canvas
- elevated canvas
- primary panel
- secondary panel
- inset panel
- border
- strong border
- overlay
- scrim

### Typography tokens
- display-2xl, display-xl, display-lg
- heading-xl, heading-lg, heading-md
- body-lg, body-md, body-sm
- label, overline, mono, metric

### Spacing scale
Use a consistent 4px base scale. Define spacing values centrally; avoid arbitrary one-off values unless a visual exception is documented.

### Shape and border
Use hard-edged rectangles and intentional radii. Avoid excessive rounded-pill cards. Strong outlines and offset shadows are part of the brand.

## 3. Layout system

Desktop:
- Persistent left navigation.
- Top command bar.
- Main canvas.
- Optional right contextual panel.
- Content max widths appropriate to the task.

Tablet:
- Collapsible sidebar and contextual drawer.

Mobile:
- Compact navigation.
- Prioritized cards and stacked data rows.
- Persistent access to critical approvals and alerts.

Use responsive grids and avoid horizontal page overflow.

## 4. Component catalog

Core:
- RiotAppShell
- RiotSidebar
- RiotTopbar
- RiotCommandPalette
- RiotPanel
- RiotCard
- RiotButton
- RiotBadge
- RiotTabs
- RiotDialog
- RiotPopover
- RiotToast
- RiotTooltip
- RiotTable
- RiotFormField
- RiotEmptyState
- RiotSkeleton

Domain:
- SignalCard
- EvidenceRow
- OpportunityScore
- OpportunityCard
- ProductBriefPanel
- ProductionStage
- AssetPreview
- ProvenancePanel
- InspectionFinding
- InspectionReport
- MarketplaceChannelCard
- ListingReadiness
- RevenueMetric
- FeeBreakdown
- AftershockInsight
- AgentCard
- WorkflowRunRow
- ApprovalCard
- CharacterIllustration
- ComicHeader
- HalftoneSurface
- TechnicalStamp

Components must have:
- Typed props.
- Clear variants.
- Sensible empty/loading/error states.
- Keyboard behavior.
- Accessible names and focus.
- Responsive behavior.
- Theme support.
- No dead controls.

## 5. Status system

Standard status vocabulary:
- DRAFT
- QUEUED
- RUNNING
- NEEDS REVIEW
- BLOCKED
- READY
- PUBLISHED
- PAUSED
- FAILED
- ARCHIVED

Inspection result vocabulary:
- PASS
- WARNING
- BLOCKED
- NEEDS REVIEW

Do not conflate product lifecycle status, job execution status, and policy inspection status.

## 6. Data visualization

- Use chart labels and units.
- Mark demo data clearly.
- Distinguish gross receipts from net contribution.
- Show date range and timezone.
- Provide accessible table/data alternative when chart is important.
- Avoid decorative charts with invented business meaning.
- Use one chart accent at a time; reserve brand colors for emphasis.

## 7. Interaction and motion

- Provide visible hover, focus, pressed, selected, disabled, and loading states.
- Support keyboard navigation.
- Respect reduced motion.
- Use short, purposeful transitions.
- Do not animate financial values in a misleading way.
- Toasts confirm only completed prototype actions or verified real actions.
- Confirm destructive or irreversible actions.

## 8. Asset rules

- Store original SVG/illustration sources in the repository when implemented.
- Use explicit asset names and metadata.
- Keep logos, characters, and icon families versioned.
- Avoid hotlinked random images for production identity.
- Document licensing and source for all third-party assets.
- Provide light/dark variants where necessary.

## 9. Accessibility

Target WCAG 2.2 AA as a design goal:
- Sufficient contrast.
- Visible focus.
- Semantic headings and landmarks.
- Labels for inputs.
- Screen-reader descriptions for meaningful artwork.
- No color-only states.
- Accessible dialogs and menus.
- Keyboard-operable navigation.
- Reduced motion.
- Readable type and responsive zoom behavior.

## 10. Quality gates

A component is not approved until:
- Dark and light theme states are checked.
- Desktop and mobile states are checked.
- Keyboard operation is checked.
- Focus and contrast are checked.
- Loading/empty/error states are defined.
- No overflow or misleading status appears.
