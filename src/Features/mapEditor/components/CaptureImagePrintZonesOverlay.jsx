import { useCallback, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";

import { setPrintZonesCaptureInsets } from "Features/popperImages/popperImagesSlice";

import CaptureImageTileCard from "./CaptureImageTileCard";

import useImagePrintZonesLayout from "Features/popperImages/hooks/useImagePrintZonesLayout";
import {
  IMAGE_LINK_STROKE,
  IMAGE_LINK_STROKE_WIDTH,
} from "Features/popperImages/constants/imageDisplay";
import { getPrintZoneTileLinkPoint } from "Features/popperImages/utils/layoutImagePrintZones";

// ---------------------------------------------------------------------------
// CaptureImagePrintZonesOverlay — the photos of a capture in "print zones"
// mode: Paper-style tiles dispatched in 4 bands along the edges of the
// capture rect (same layout as ImagesPrintZonesOverlay in the editors:
// useImagePrintZonesLayout), each tied to its anchor by a leader ("Ligne")
// and / or its display number ("Numéro"). The bands keep clear of the
// elements of the frame tagged `data-print-zones-avoid` (legend, cartouche,
// title banner, logo). Rendered INSIDE the ImageModeOverlay svg, in svg px,
// as `data-capture-keep` groups. Fully automatic: no handle. The thickness
// taken on each side is published (popperImages.printZonesCaptureInsets) for
// the labels margin band.
// ---------------------------------------------------------------------------

const AVOID_SELECTOR = "[data-print-zones-avoid]";

export default function CaptureImagePrintZonesOverlay({
  rect,
  images,
  showLines,
  showNumbers,
  anchorProjector,
  svgRef,
}) {
  const dispatch = useDispatch();

  // helpers

  const getFrame = useCallback(() => {
    const svg = svgRef?.current;
    if (!svg) return null;
    const o = svg.getBoundingClientRect();
    const reserved = [];
    svg.querySelectorAll(AVOID_SELECTOR).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0) || !(r.height > 0)) return;
      reserved.push({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    });
    return {
      origin: { left: o.left, top: o.top },
      rect: {
        left: o.left + rect.left,
        top: o.top + rect.top,
        width: rect.width,
        height: rect.height,
      },
      reserved,
    };
  }, [svgRef, rect.left, rect.top, rect.width, rect.height]);

  const { tiles, insets, anchorsById } = useImagePrintZonesLayout({
    active: true,
    images,
    anchorProjector,
    getFrame,
  });

  const imagesById = useMemo(
    () => Object.fromEntries((images ?? []).map((a) => [a.id, a])),
    [images]
  );
  // `images` comes in display order: the badge number is the rank.
  const numberById = useMemo(
    () => Object.fromEntries((images ?? []).map((a, i) => [a.id, i + 1])),
    [images]
  );

  // effects

  const { top, right, bottom, left } = insets;
  useEffect(() => {
    dispatch(setPrintZonesCaptureInsets({ top, right, bottom, left }));
  }, [dispatch, top, right, bottom, left]);
  useEffect(
    () => () => {
      dispatch(setPrintZonesCaptureInsets(null));
    },
    [dispatch]
  );

  // render

  if (!tiles.length) return null;

  return (
    <>
      {/* Leaders: tile inner edge → anchor (svg px). */}
      {showLines && (
        <g data-capture-keep style={{ pointerEvents: "none" }}>
          {tiles.map((t) => {
            const a = anchorsById[t.id];
            if (!a?.inside) return null;
            const p = getPrintZoneTileLinkPoint(t, a);
            return (
              <g key={t.id}>
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={a.x}
                  y2={a.y}
                  stroke={IMAGE_LINK_STROKE}
                  strokeWidth={IMAGE_LINK_STROKE_WIDTH}
                />
                <circle cx={p.x} cy={p.y} r={3} fill={IMAGE_LINK_STROKE} />
              </g>
            );
          })}
        </g>
      )}

      <g data-capture-keep style={{ pointerEvents: "none" }}>
        {tiles.map((t) => (
          <CaptureImageTileCard
            key={t.id}
            tile={{ ...t, number: numberById[t.id] }}
            annotation={imagesById[t.id]}
            showNumber={showNumbers}
          />
        ))}
      </g>
    </>
  );
}
