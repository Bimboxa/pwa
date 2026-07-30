// SVG layer drawing the two vanishing-line families (U / V) of a photoPlan
// calibration over a photo, with draggable endpoint handles. Pure display —
// the drag itself is handled by the hosting viewer (mouse events bubble to
// its onMouseDown, hit-tested via the data-* attributes below).
//
// Coordinates: `vanishingLines` segments are NORMALIZED [0..1]; width/height
// are the photo image size in px (the viewer's world space).

export const FUITE_U_COLOR = "#2196f3";
export const FUITE_V_COLOR = "#fb8c00";
export const COTE_COLOR = "#9c27b0";

const FAMILY_COLORS = { u: FUITE_U_COLOR, v: FUITE_V_COLOR };

function EndpointHandle({ x, y, color, containerK, family, segId, end }) {
  return (
    <g
      transform={`translate(${x}, ${y})`}
      data-interaction="fuite-endpoint"
      data-family={family}
      data-seg-id={segId}
      data-end={end}
      style={{ cursor: "grab" }}
    >
      <g
        style={{
          transform: `scale(calc(1 / (var(--map-zoom, 1) * ${containerK})))`,
          transformOrigin: "0 0",
        }}
      >
        {/* invisible fat hit area */}
        <circle r="14" fill="transparent" />
        <circle r="7" fill="white" stroke={color} strokeWidth="2.5" />
        <circle r="2.5" fill={color} />
      </g>
    </g>
  );
}

export default function VanishingLinesLayer({
  vanishingLines,
  knownCote,
  width,
  height,
  containerK = 1,
}) {
  if (!vanishingLines || !width || !height) return null;

  return (
    <g data-layer="vanishing-lines">
      {/* Optional known-dimension segment ("cote connue") — drives the
          metric scale instead of the pastille spacing. Same endpoint-drag
          mechanism, pseudo-family "cote". */}
      {knownCote?.p1 &&
        knownCote?.p2 &&
        (() => {
          const cx1 = knownCote.p1.x * width;
          const cy1 = knownCote.p1.y * height;
          const cx2 = knownCote.p2.x * width;
          const cy2 = knownCote.p2.y * height;
          // Perpendicular end ticks (NodeCoteStatic convention): rotate the
          // local frame onto the segment, draw a vertical tick, counter-scale
          // so it stays a fixed screen size.
          const angleDeg = (Math.atan2(cy2 - cy1, cx2 - cx1) * 180) / Math.PI;
          const tick = (x, y) => (
            <g transform={`translate(${x}, ${y}) rotate(${angleDeg})`}>
              <g
                style={{
                  transform: `scale(calc(1 / (var(--map-zoom, 1) * ${containerK})))`,
                  transformOrigin: "0 0",
                }}
              >
                <line
                  x1={0}
                  y1={-10}
                  x2={0}
                  y2={10}
                  stroke={COTE_COLOR}
                  strokeWidth={2.5}
                />
              </g>
            </g>
          );
          return (
            <g>
              <line
                x1={cx1}
                y1={cy1}
                x2={cx2}
                y2={cy2}
                stroke={COTE_COLOR}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                opacity={0.95}
              />
              {tick(cx1, cy1)}
              {tick(cx2, cy2)}
            </g>
          );
        })()}
      {knownCote?.p1 && knownCote?.p2 && (
        <g>
          <EndpointHandle
            x={knownCote.p1.x * width}
            y={knownCote.p1.y * height}
            color={COTE_COLOR}
            containerK={containerK}
            family="cote"
            segId="cote"
            end="p1"
          />
          <EndpointHandle
            x={knownCote.p2.x * width}
            y={knownCote.p2.y * height}
            color={COTE_COLOR}
            containerK={containerK}
            family="cote"
            segId="cote"
            end="p2"
          />
        </g>
      )}
      {["u", "v"].flatMap((family) => {
        const color = FAMILY_COLORS[family];
        return (vanishingLines[family] ?? []).map((seg) => {
          const x1 = seg.p1.x * width;
          const y1 = seg.p1.y * height;
          const x2 = seg.p2.x * width;
          const y2 = seg.p2.y * height;
          return (
            <g key={`${family}-${seg.id}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray="8 5"
                vectorEffect="non-scaling-stroke"
                opacity={0.9}
              />
              <EndpointHandle
                x={x1}
                y={y1}
                color={color}
                containerK={containerK}
                family={family}
                segId={seg.id}
                end="p1"
              />
              <EndpointHandle
                x={x2}
                y={y2}
                color={color}
                containerK={containerK}
                family={family}
                segId={seg.id}
                end="p2"
              />
            </g>
          );
        });
      })}
    </g>
  );
}
