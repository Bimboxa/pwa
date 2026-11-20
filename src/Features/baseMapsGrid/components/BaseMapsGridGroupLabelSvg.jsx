import { useLayoutEffect, useRef, useState } from "react";

import theme from "Styles/theme";

import { FADE_DURATION_MS } from "../constants/baseMapsGridConstants";
import {
  GROUP_LABEL_HEIGHT,
  GROUP_LABEL_WIDTH,
} from "../utils/composeBaseMapsGridGroupedSheets";

const FONT_SIZE = 26;
const EYE_SIZE = 30;
const EYE_GAP = 14;

// MUI Visibility / VisibilityOff glyphs (24 x 24)
const EYE_PATH =
  "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3";
const EYE_OFF_PATH =
  "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7M2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2m4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3z";

// Label of a group of sheets (a base maps folder) on the 2D table: the
// folder name in light grey at the TOP LEFT of its sheets (right-aligned
// next to the bar, the eye just before it), with an eye hiding
// / showing every sheet of the group at once, and a vertical bar running
// along the sheets of the group (none while they are hidden). The click is handled by the table (see
// LayerBaseMapsGrid, `data-group-eye-id`), which tells a click from a pan.
export default function BaseMapsGridGroupLabelSvg({
  label,
  visible,
  disabled,
}) {
  // strings

  const hideS = "Masquer les fonds de plan du dossier";
  const showS = "Afficher les fonds de plan du dossier";

  // helpers

  const color = theme.palette.text.disabled;
  const scale = EYE_SIZE / 24;
  const clipId = `grid-group-label-${label.id}`;
  const barColor = theme.palette.divider;
  const nameS =
    label.hidden && label.count > 0
      ? `${label.name} (${label.count})`
      : label.name;
  const textMaxWidth = GROUP_LABEL_WIDTH - EYE_SIZE - EYE_GAP;

  // state - measured width of the name: the label is right-aligned on the
  // bar, the eye sits just before the name

  const textRef = useRef(null);
  const [textWidth, setTextWidth] = useState(textMaxWidth);
  useLayoutEffect(() => {
    const width = textRef.current?.getComputedTextLength?.();
    if (width > 0) setTextWidth(Math.min(width, textMaxWidth));
  }, [nameS, textMaxWidth]);

  const eyeX = -(textWidth + EYE_GAP + EYE_SIZE);

  // render

  return (
    <g
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_DURATION_MS}ms ease`,
      }}
    >
      {label.bar && (
        <line
          x1={label.bar.x}
          y1={label.bar.y1}
          x2={label.bar.x}
          y2={label.bar.y2}
          stroke={barColor}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      )}
      <g transform={`translate(${label.x}, ${label.y})`}>
        <clipPath id={clipId}>
          <rect
            x={-textMaxWidth}
            width={textMaxWidth}
            height={GROUP_LABEL_HEIGHT}
          />
        </clipPath>
        <g
          data-group-eye-id={label.id}
          transform={`translate(${eyeX}, 0)`}
          style={{ cursor: disabled ? "default" : "pointer" }}
        >
          <title>{label.hidden ? showS : hideS}</title>
          <rect
            width={EYE_SIZE}
            height={GROUP_LABEL_HEIGHT}
            fill="transparent"
          />
          <path
            d={label.hidden ? EYE_OFF_PATH : EYE_PATH}
            transform={`translate(0, ${
              (GROUP_LABEL_HEIGHT - EYE_SIZE) / 2
            }) scale(${scale})`}
            fill={color}
          />
        </g>
        <text
          ref={textRef}
          clipPath={`url(#${clipId})`}
          x={-textWidth}
          y={GROUP_LABEL_HEIGHT / 2}
          dominantBaseline="central"
          fontSize={FONT_SIZE}
          fontFamily={theme.typography.fontFamily}
          fontWeight={600}
          letterSpacing="0.04em"
          fill={color}
          style={{ textTransform: "uppercase", pointerEvents: "none" }}
        >
          {nameS}
        </text>
      </g>
    </g>
  );
}
