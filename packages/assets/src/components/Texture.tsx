import type { CSSProperties } from "react";
import { getAsset, type TextureName } from "../registry";

export interface TextureProps {
  name: TextureName;
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}

export function Texture({ name, opacity = 0.06, className, style }: TextureProps) {
  const asset = getAsset(name);
  const safeOpacity = Math.min(1, Math.max(0, opacity));

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        backgroundImage: `url("${asset.src}")`,
        backgroundRepeat: "repeat",
        opacity: safeOpacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
