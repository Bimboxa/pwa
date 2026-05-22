import {useEffect, useState} from "react";

import {Box} from "@mui/material";

import resolveDocImageSrc from "../../utils/resolveDocImageSrc";

export default function MarkdownImage({src, alt, pageId, imageLoaders}) {
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    let cancelled = false;
    resolveDocImageSrc(src, {pageId, imageLoaders}).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src, pageId, imageLoaders]);

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
      sx={{maxWidth: "100%", height: "auto", borderRadius: 1, my: 2}}
    />
  );
}
