import type { ImgHTMLAttributes } from "react";
import { getAsset, type AssetId } from "../registry";

export interface AssetImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height" | "aria-hidden"> {
  name: AssetId;
  alt?: string;
  decorative?: boolean;
  width?: number;
  height?: number;
}

export function AssetImage({
  name,
  alt,
  decorative,
  width,
  height,
  loading = "lazy",
  ...imageProps
}: AssetImageProps) {
  const asset = getAsset(name);
  const isDecorative = decorative ?? asset.decorative;

  return (
    <img
      {...imageProps}
      src={asset.src}
      alt={isDecorative ? "" : alt ?? ("alt" in asset ? asset.alt : undefined) ?? asset.description}
      width={width ?? asset.width}
      height={height ?? asset.height}
      loading={loading}
      aria-hidden={isDecorative ? true : undefined}
    />
  );
}
