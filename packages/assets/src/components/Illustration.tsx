import { AssetImage, type AssetImageProps } from "./AssetImage";
import type { IllustrationName } from "../registry";

export interface IllustrationProps extends Omit<AssetImageProps, "name"> {
  name: IllustrationName;
}

export function Illustration({ name, decorative, ...props }: IllustrationProps) {
  return <AssetImage name={name} decorative={decorative ?? false} {...props} />;
}
