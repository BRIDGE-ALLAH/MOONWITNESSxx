export type AssetCategory =
  | "brand"
  | "character"
  | "illustration"
  | "symbol"
  | "texture"
  | "pattern"
  | "motion"
  | "typography"
  | "document";

export type AssetTheme = "universal" | "light" | "dark";

export interface RegisteredAsset {
  readonly id: string;
  readonly category: AssetCategory;
  readonly description: string;
  readonly alt?: string;
  readonly decorative: boolean;
  readonly theme: AssetTheme;
  readonly source: string;
  readonly license: string;
  readonly tags: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly mimeType: "image/svg+xml";
  readonly src: string;
}
