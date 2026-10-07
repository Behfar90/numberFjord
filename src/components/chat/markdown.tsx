"use client";

import {
  defaultRehypePlugins,
  Streamdown,
  type StreamdownProps,
} from "streamdown";

// Streamdown allows any link and image by default. Answers only need SSB links,
// and a model-written image URL could leak data, so block the rest.
export const ALLOWED_LINK_PREFIXES = [
  "https://www.ssb.no/",
  "https://data.ssb.no/",
];

const [harden] = defaultRehypePlugins.harden as [unknown, unknown];

const rehypePlugins = [
  defaultRehypePlugins.sanitize,
  [
    harden,
    {
      defaultOrigin: "https://www.ssb.no",
      allowedLinkPrefixes: ALLOWED_LINK_PREFIXES,
      allowedImagePrefixes: [],
      allowDataImages: false,
      linkBlockPolicy: "text-only",
      imageBlockPolicy: "remove",
    },
  ],
] as StreamdownProps["rehypePlugins"];

export function Markdown({
  children,
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  return (
    <Streamdown
      rehypePlugins={rehypePlugins}
      isAnimating={streaming}
      controls={false}
      linkSafety={{ enabled: false }}
    >
      {children}
    </Streamdown>
  );
}
