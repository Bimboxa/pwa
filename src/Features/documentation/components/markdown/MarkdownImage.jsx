import {useEffect, useState} from "react";

import {Box} from "@mui/material";

import resolveDocImageSrc from "../../utils/resolveDocImageSrc";

// Parse optional display hints from the URL fragment, e.g.
// `./images/x.gif#w=75%&align=center`. Supported keys:
//   w / h   -> width / height (a bare number is treated as px)
//   align   -> left | center | right (block image alignment)
// Returns an MUI `sx` partial — empty when no hint.
function parseSizeHint(fragment) {
  const sx = {};
  if (!fragment) return sx;
  // The Markdown parser percent-encodes the URL fragment (e.g. `50%` -> `50%25`),
  // so decode it back before reading CSS values.
  let decoded = fragment;
  try {
    decoded = decodeURIComponent(fragment);
  } catch {
    // keep raw fragment if it is not valid percent-encoding
  }
  for (const part of decoded.split("&")) {
    const [rawKey, rawVal] = part.split("=");
    if (!rawVal) continue;
    if (rawKey === "w" || rawKey === "h") {
      const key = rawKey === "w" ? "width" : "height";
      sx[key] = /^\d+$/.test(rawVal) ? `${rawVal}px` : rawVal;
    } else if (rawKey === "align") {
      sx.display = "block";
      if (rawVal === "center") sx.mx = "auto";
      else if (rawVal === "right") (sx.ml = "auto"), (sx.mr = 0);
      else (sx.mr = "auto"), (sx.ml = 0);
    }
  }
  return sx;
}

export default function MarkdownImage({src, alt, pageId, imageLoaders}) {
  const [resolved, setResolved] = useState(null);

  // Split off an optional `#…` sizing hint so the resolver only sees the path.
  const [path, fragment] = (src ?? "").split("#");
  const sizeSx = parseSizeHint(fragment);

  useEffect(() => {
    let cancelled = false;
    resolveDocImageSrc(path, {pageId, imageLoaders}).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [path, pageId, imageLoaders]);

  if (!resolved) {
    return (
      <Box
        component="span"
        sx={{
          display: "inline-block",
          px: 1,
          py: 0.25,
          fontSize: 12,
          color: "text.secondary",
          border: (t) => `1px dashed ${t.palette.divider}`,
          borderRadius: 1,
        }}
      >
        {alt || src}
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={resolved}
      alt={alt ?? ""}
      sx={{maxWidth: "100%", height: "auto", borderRadius: 1, my: 2, ...sizeSx}}
    />
  );
}
