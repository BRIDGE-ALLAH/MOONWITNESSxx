import type { RegisteredAsset } from "./types";

const repositoryAsset = "Original MOONWITNESS asset authored for this repository; source SVG is stored alongside the registry.";
const internalLicense = "UNLICENSED — internal project use only; external redistribution requires explicit owner approval.";

export const assetRegistry = {
  "texture.halftone": {
    id: "texture.halftone", category: "texture",
    description: "Subtle, evenly spaced halftone dots for restrained surface treatment.",
    decorative: true, theme: "universal", source: repositoryAsset, license: internalLicense,
    tags: ["halftone", "comic", "surface", "decorative"], width: 256, height: 256,
    mimeType: "image/svg+xml", src: new URL("../assets/textures/halftone-dots.svg", import.meta.url).href,
  },
  "texture.industrial-grid": {
    id: "texture.industrial-grid", category: "texture",
    description: "Low-contrast technical grid for industrial surfaces.",
    decorative: true, theme: "universal", source: repositoryAsset, license: internalLicense,
    tags: ["grid", "industrial", "technical", "decorative"], width: 256, height: 256,
    mimeType: "image/svg+xml", src: new URL("../assets/textures/industrial-grid.svg", import.meta.url).href,
  },
  "brand.symbol": {
    id: "brand.symbol", category: "brand",
    description: "Primary lunar aperture symbol with orbital arc and witness star.",
    alt: "MOONWITNESS lunar aperture symbol.", decorative: false, theme: "universal",
    source: repositoryAsset, license: internalLicense, tags: ["logo", "symbol", "master-brand"],
    width: 128, height: 128, mimeType: "image/svg+xml",
    src: new URL("../assets/brand/moonwitness-symbol.svg", import.meta.url).href,
  },
  "brand.wordmark": {
    id: "brand.wordmark", category: "brand",
    description: "Primary MOONWITNESS wordmark.",
    alt: "MOONWITNESS.", decorative: false, theme: "universal",
    source: repositoryAsset, license: internalLicense, tags: ["logo", "wordmark", "master-brand"],
    width: 680, height: 112, mimeType: "image/svg+xml",
    src: new URL("../assets/brand/moonwitness-wordmark.svg", import.meta.url).href,
  },
  "brand.lockup": {
    id: "brand.lockup", category: "brand",
    description: "Primary symbol and wordmark lockup with core brand line.",
    alt: "MOONWITNESS — See more. Know more.", decorative: false, theme: "universal",
    source: repositoryAsset, license: internalLicense, tags: ["logo", "lockup", "master-brand"],
    width: 820, height: 180, mimeType: "image/svg+xml",
    src: new URL("../assets/brand/moonwitness-lockup.svg", import.meta.url).href,
  },
  "brand.archive-seal": {
    id: "brand.archive-seal", category: "brand",
    description: "Circular archive seal for approved archival and editorial contexts.",
    alt: "MOONWITNESS archive seal.", decorative: false, theme: "universal",
    source: repositoryAsset, license: internalLicense, tags: ["seal", "archive", "stamp"],
    width: 256, height: 256, mimeType: "image/svg+xml",
    src: new URL("../assets/brand/moonwitness-seal.svg", import.meta.url).href,
  },
  "texture.lunar-contours": {
    id: "texture.lunar-contours", category: "texture",
    description: "Original lunar topography contour lines for subtle observatory surfaces.",
    decorative: true, theme: "universal", source: repositoryAsset, license: internalLicense,
    tags: ["lunar", "contour", "topography", "decorative"], width: 320, height: 320,
    mimeType: "image/svg+xml", src: new URL("../assets/textures/lunar-contours.svg", import.meta.url).href,
  },
  "texture.orbital-grid": {
    id: "texture.orbital-grid", category: "texture",
    description: "Measured orbital grid with concentric rings and a single observation point.",
    decorative: true, theme: "universal", source: repositoryAsset, license: internalLicense,
    tags: ["orbit", "grid", "instrument", "decorative"], width: 320, height: 320,
    mimeType: "image/svg+xml", src: new URL("../assets/textures/orbital-grid.svg", import.meta.url).href,
  },
  "pattern.archive-rules": {
    id: "pattern.archive-rules", category: "pattern",
    description: "Editorial ruled-paper pattern for archival and document-like surfaces.",
    decorative: true, theme: "universal", source: repositoryAsset, license: internalLicense,
    tags: ["archive", "editorial", "rules", "decorative"], width: 320, height: 160,
    mimeType: "image/svg+xml", src: new URL("../assets/patterns/archive-rules.svg", import.meta.url).href,
  },
  "illustration.observation-desk": {
    id: "illustration.observation-desk", category: "illustration",
    description: "Quiet observatory desk with telescope, lunar disc, and field notebook.",
    alt: "An observatory desk with a telescope, moon, and open notebook.",
    decorative: false, theme: "universal", source: repositoryAsset, license: internalLicense,
    tags: ["observatory", "research", "empty-state", "editorial"], width: 480, height: 320,
    mimeType: "image/svg+xml", src: new URL("../assets/illustrations/observation-desk.svg", import.meta.url).href,
  },
  "illustration.evidence-constellation": {
    id: "illustration.evidence-constellation", category: "illustration",
    description: "Abstract network of connected evidence records around an observation point.",
    alt: "Connected evidence points arranged around a central observation marker.",
    decorative: false, theme: "universal", source: repositoryAsset, license: internalLicense,
    tags: ["evidence", "research", "network", "editorial"], width: 480, height: 320,
    mimeType: "image/svg+xml", src: new URL("../assets/illustrations/evidence-constellation.svg", import.meta.url).href,
  },
  "illustration.empty-search": {
    id: "illustration.empty-search", category: "illustration",
    description: "Abstract empty-search illustration for a search with no matching results.",
    alt: "A magnifying glass over an empty search panel.", decorative: false, theme: "universal",
    source: repositoryAsset, license: internalLicense, tags: ["empty-state", "search", "product"],
    width: 320, height: 220, mimeType: "image/svg+xml",
    src: new URL("../assets/illustrations/empty-search.svg", import.meta.url).href,
  },
  "illustration.error-general": {
    id: "illustration.error-general", category: "illustration",
    description: "Abstract warning illustration for a recoverable application error.",
    alt: "A warning mark inside a bold outlined panel.", decorative: false, theme: "universal",
    source: repositoryAsset, license: internalLicense, tags: ["error-state", "warning", "recovery"],
    width: 320, height: 220, mimeType: "image/svg+xml",
    src: new URL("../assets/illustrations/error-general.svg", import.meta.url).href,
  },
} as const satisfies Record<string, RegisteredAsset>;

export type AssetId = keyof typeof assetRegistry;
export type IllustrationName = Extract<AssetId, `illustration.${string}`>;
export type TextureName = Extract<AssetId, `texture.${string}`>;

export function getAsset<TAsset extends AssetId>(id: TAsset): (typeof assetRegistry)[TAsset] {
  return assetRegistry[id];
}

export function resolveAsset(id: string): RegisteredAsset | undefined {
  if (!Object.prototype.hasOwnProperty.call(assetRegistry, id)) return undefined;
  return assetRegistry[id as AssetId];
}
