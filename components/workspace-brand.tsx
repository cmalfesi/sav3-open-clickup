"use client";

import { useState } from "react";

export function WorkspaceBrand({ name, color, logo }: {
  name: string;
  color: string;
  logo: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-bold text-white"
        style={{ backgroundColor: logo && failed !== logo ? "transparent" : color }}>
        {logo && failed !== logo
          // The logo is session-protected or a local preview URL.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logo} alt="" className="h-full w-full object-contain" onError={() => setFailed(logo)} />
          : Array.from(name.trim())[0]?.toUpperCase() || "?"}
      </span>
      <span className="truncate text-sm font-semibold" title={name}>{name}</span>
    </>
  );
}
