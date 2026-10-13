import { Box, Typography } from "@mui/material";

// Bars of a layout line drawn horizontally, one under the other, each piece
// as a stroke (holes stay blank), the bar length written at the right end.
// The longest bar fills the drawable width.

const W = 260;
const ROW_H = 10;
const LABEL_W = 44;
const PAD = 2;
const MAX_ROWS = 200;

export default function SvgLayoutLineBars({ bars }) {
  // data

  const rows = (bars || []).slice(0, MAX_ROWS);
  const hiddenCount = (bars?.length || 0) - rows.length;
  const maxLengthPx = rows.reduce((acc, b) => {
    const span = b.pieces[b.pieces.length - 1].u1 - b.pieces[0].u0;
    return Math.max(acc, span);
  }, 0);
  const drawableW = W - LABEL_W - 2 * PAD;
  const k = maxLengthPx > 0 ? drawableW / maxLengthPx : 0;
  const H = rows.length * ROW_H + 2 * PAD;

  // render

  if (rows.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Aucune barre
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 320, overflowY: "auto", color: "text.primary" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {rows.map((bar, i) => {
          const y = PAD + i * ROW_H + ROW_H / 2;
          const u0min = bar.pieces[0].u0;
          return (
            <g key={bar.index}>
              {bar.pieces.map((piece, pi) => (
                <line
                  key={pi}
                  x1={PAD + (piece.u0 - u0min) * k}
                  x2={PAD + (piece.u1 - u0min) * k}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ))}
              <text
                x={W - PAD}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={7}
                fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                fill="#757575"
              >
                {`${bar.lengthM.toFixed(2)} m`}
              </text>
            </g>
          );
        })}
      </svg>
      {hiddenCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          {`… +${hiddenCount} barres`}
        </Typography>
      )}
    </Box>
  );
}
