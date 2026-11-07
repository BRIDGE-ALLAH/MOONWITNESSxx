import type { RegisteredAsset } from "./types";

const repositoryAsset = "Created for the MOONWITNESS repository; original SVG source is stored alongside this registry.";
const internalLicense = "UNLICENSED — internal project use only; confirm redistribution rights before external use.";

export const assetRegistry = {
  "texture.halftone": {
    id: "texture.halftone",
    category: "texture",
    description: "Subtle, evenly spaced halftone dots for restrained Riot mode surface treatment.",
    decorative: true,
    theme: "universal",
    source: repositoryAsset,
    license: internalLicense,
    tags: ["halftone", "comic", "surface", "decorative"],
    width: 256,
    height: 256,
    mimeType: "image/svg+xml",
    src: new URL("../assets/textures/halftone-dots.svg", import.meta.url).href,
  },
  "texture.industrial-grid": {
    id: "texture.industrial-grid",
    category: "texture",
    description: "Low-contrast technical grid for workshop and industrial surfaces.",
    decorative: true,
    theme: "universal",
    source: repositoryAsset,
    license: internalLicense,
    tags: ["grid", "industrial", "technical", "decorative"],
    width: 256,
    height: 256,
    mimeType: "image/svg+xml",
    src: new URL("../assets/textures/industrial-grid.svg", import.meta.url).href,
  },
  "illustration.empty-search": {
    id: "illustration.empty-search",
    category: "illustration",
    description: "Abstract empty-search illustration for a search with no matching results.",
    alt: "A magnifying glass over an empty search panel.",
    decorative: false,
    theme: "universal",
    source: repositoryAsset,
    license: internalLicense,
    tags: ["empty-state", "search", "product"],
    width: 320,
    height: 220,
    mimeType: "image/svg+xml",
    src: new URL("../assets/illustrations/empty-search.svg", import.meta.url).href,
  },
  "illustration.error-general": {
    id: "illustration.error-general",
    category: "illustration",
    description: "Abstract warning illustration for a recoverable application error.",
    alt: "A warning mark inside a bold outlined panel.",
    decorative: false,
    theme: "universal",
    source: repositoryAsset,
    license: internalLicense,
    tags: ["error-state", "warning", "recovery"],
    width: 320,
    height: 220,
    mimeType: "image/svg+xml",
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
