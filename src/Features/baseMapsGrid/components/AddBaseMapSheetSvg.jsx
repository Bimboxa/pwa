import { useState } from "react";

import theme from "Styles/theme";

import { SHEET_SHADOW_FILTER_ID } from "./BaseMapSheetSvg";

import {
  FADE_DURATION_MS,
  LIFT_DURATION_MS,
  RAISE_OFFSET,
} from "../constants/baseMapsGridConstants";

const PLUS_SIZE = 72;
const REST_FILL = "rgba(0,0,0,0.06)";

// Empty frame closing the grid (bottom-right slot): its "+" opens the
// "create a base map" section. At rest, a "+" on a grey slot of the table;
// under the pointer the slot turns into a white paper rising off the table.
// The click is handled by the table (see LayerBaseMapsGrid), which tells a
// click from a pan started on the frame.
export default function AddBaseMapSheetSvg({ sheet, visible, disabled }) {
  // strings

  const addS = "Nouveau fond de plan";

  // state

  const [hovered, setHovered] = useState(false);

  // helpers

  const raised = hovered && !disabled;
  const cx = sheet.width / 2;
  const cy = sheet.height / 2;
  const color = raised
    ? theme.palette.text.primary
    : theme.palette.text.secondary;
  const lift = `${LIFT_DURATION_MS}ms ease`;

  // render

  return (
    <g
      data-sheet-id={sheet.id}
      transform={`translate(${sheet.x}, ${sheet.y})`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        cursor: disabled ? "default" : "pointer",
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_DURATION_MS}ms ease`,
      }}
    >
      <title>{addS}</title>

      {/* still hit area (the paper moves under the pointer) */}
      <rect width={sheet.width} height={sheet.height} fill="transparent" />

      <g
        style={{
          transform: `translateY(${raised ? -RAISE_OFFSET : 0}px)`,
          transition: `transform ${lift}`,
          pointerEvents: "none",
        }}
      >
        {/* paper + shadow, fading in over the grey slot */}
        <rect
          width={sheet.width}
          height={sheet.height}
          fill="white"
          filter={`url(#${SHEET_SHADOW_FILTER_ID})`}
          style={{ opacity: raised ? 1 : 0, transition: `opacity ${lift}` }}
        />
        <rect
          width={sheet.width}
          height={sheet.height}
          rx={raised ? 0 : 8}
          fill={REST_FILL}
          stroke={theme.palette.text.secondary}
          strokeWidth={1.5}
          strokeDasharray="8 6"
          vectorEffect="non-scaling-stroke"
          style={{ opacity: raised ? 0 : 1, transition: `opacity ${lift}` }}
        />
        <g
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          style={{ transition: `stroke ${lift}` }}
        >
          <line
            x1={cx - PLUS_SIZE / 2}
            y1={cy}
            x2={cx + PLUS_SIZE / 2}
            y2={cy}
          />
          <line
            x1={cx}
            y1={cy - PLUS_SIZE / 2}
            x2={cx}
            y2={cy + PLUS_SIZE / 2}
          />
        </g>
      </g>
    </g>
  );
}
