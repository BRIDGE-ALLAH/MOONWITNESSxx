import type { HTMLAttributes } from "react";
import { Texture } from "@riotworks/assets";
import { cn } from "../lib/utils";

export interface HalftoneSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  textureOpacity?: number;
}

export function HalftoneSurface({
  children,
  className,
  textureOpacity = 0.08,
  ...props
}: HalftoneSurfaceProps) {
  return (
    <div {...props} className={cn("relative isolate overflow-hidden", className)}>
      <Texture
        name="texture.halftone"
        opacity={textureOpacity}
        className="pointer-events-none absolute inset-0 z-0"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
