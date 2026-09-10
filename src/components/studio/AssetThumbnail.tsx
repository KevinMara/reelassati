import { useState } from "react";
import { Film } from "lucide-react";
import type { Asset } from "@contracts/workspace";

export function AssetThumbnail({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <Film aria-label="Preview unavailable" className="h-5 w-5 text-primary" />
    );
  if (asset.kind === "image")
    return (
      <img
        src={asset.url}
        alt={asset.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  return (
    <video
      src={`${asset.url}#t=0.1`}
      aria-label={`Preview of ${asset.name}`}
      muted
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}
