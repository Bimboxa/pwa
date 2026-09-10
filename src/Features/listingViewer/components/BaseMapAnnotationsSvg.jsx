import { useRef, useState, useEffect, useMemo } from "react";

import { Box, Typography } from "@mui/material";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

// A base map drawn with its annotations on top, scaled to fit its container.
// Shared by the two modes of the SCOPE recap: the quantity list (box shaped by
// the image itself) and the image grid (box shaped like a sheet of paper, the
// image faded out so the drawings read).
//
// `aspectRatio` is a CSS aspect-ratio for the box; omitted, the box takes the
// image's own ratio. `imageOpacity` / `grayScale` are forwarded to the image
// node only — the annotations always render at full strength.
export default function BaseMapAnnotationsSvg({
  baseMap,
  annotations = [],
  aspectRatio,
  imageOpacity = 1,
  grayScale = false,
}) {
  // strings

  const noImageS = "Pas d'image";

  // state

  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // helpers

  const imageUrl = baseMap?.getUrl?.() || baseMap?.getThumbnail?.();
  const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
  const meterByPx = baseMap?.getMeterByPx?.();
  const imageWidth = imageSize?.width;
  const imageHeight = imageSize?.height;

  // preserveAspectRatio "meet" scales the drawing by the SMALLER of the two
  // ratios. The annotation labels size themselves off containerK, so it must
  // be that same factor — taking the width one would oversize every label in
  // a letterboxed box.
  const containerK = useMemo(() => {
    if (!imageWidth || !imageHeight || !size.width || !size.height) return 1;
    return Math.min(size.width / imageWidth, size.height / imageHeight);
  }, [size, imageWidth, imageHeight]);

  const nonLabelAnnotations = useMemo(
    () => annotations?.filter((a) => a.type !== "LABEL") ?? [],
    [annotations]
  );
  const labelAnnotations = useMemo(
    () => annotations?.filter((a) => a.type === "LABEL") ?? [],
    [annotations]
  );

  const boxAspectRatio =
    aspectRatio ?? (imageWidth && imageHeight ? imageWidth / imageHeight : 1);

  // render

  if (!imageUrl || !imageSize) {
    return (
      <Box
        sx={{
          width: 1,
          aspectRatio: String(aspectRatio ?? 1.4142),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "grey.100",
          borderRadius: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {noImageS}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: 1,
        aspectRatio: String(boxAspectRatio),
      }}
    >
      <svg
        viewBox={`0 0 ${imageWidth} ${imageHeight}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <NodeSvgImage
          src={imageUrl}
          width={imageWidth}
          height={imageHeight}
          opacity={imageOpacity}
          grayScale={grayScale}
        />
        {size.width > 0 &&
          nonLabelAnnotations.map((annotation) => (
            <NodeAnnotationStatic
              key={annotation.id}
              annotation={annotation}
              imageSize={imageSize}
              baseMapMeterByPx={meterByPx}
              containerK={containerK}
              printMode
            />
          ))}
      </svg>

      {/* Labels in a separate overflow-visible SVG: a label can extend past
          the image edge, which the drawing SVG would clip. */}
      {size.width > 0 && labelAnnotations.length > 0 && (
        <svg
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          width="100%"
          height="100%"
          style={{
            display: "block",
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
          preserveAspectRatio="xMidYMid meet"
        >
          {labelAnnotations.map((annotation) => (
            <NodeAnnotationStatic
              key={annotation.id}
              annotation={annotation}
              imageSize={imageSize}
              baseMapMeterByPx={meterByPx}
              containerK={containerK}
              printMode
            />
          ))}
        </svg>
      )}
    </Box>
  );
}
