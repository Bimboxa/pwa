import {
  PAD_VALUE_LEFT,
  PAD_LABEL_RIGHT,
} from "../utils/computeTitleBlockLayout";

// Pure SVG renderer of a resolved title block layout (computeTitleBlockLayout
// output). Native SVG <text> with a Helvetica-first stack so the screen
// matches the pdf-lib Helvetica metrics at export (WYSIWYG). Each text is
// wrapped in a nested <svg> viewport so overflowing values are clipped like
// the PDF ellipsis-truncation. Interactivity (selection, logo upload) stays
// in the parent (PortfolioHeaderSvg).
export default function TitleBlockSvg({ layoutData, style = {}, logoUrl }) {
  const { frame, lines, texts, imageSlots, svgPaths } = layoutData;

  const fontFamily = style.fontFamily || "Helvetica, Arial, sans-serif";
  const borderColor = style.borderColor || "#333";
  const labelColor = style.labelColor || "#888";
  const valueColor = style.valueColor || "#333";

  return (
    <g>
      {/* Frame */}
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill="white"
        stroke={borderColor}
        strokeWidth={style.borderWidth ?? 1}
      />

      {/* Grid lines */}
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={borderColor}
          strokeWidth={style.gridWidth ?? 0.5}
        />
      ))}

      {/* Decorations */}
      {svgPaths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}
          fill={p.fill || "none"}
          stroke={p.stroke || "none"}
          strokeWidth={p.strokeWidth}
        />
      ))}

      {/* Logo */}
      {logoUrl &&
        imageSlots.map((slot) => (
          <image
            key={slot.key}
            href={logoUrl}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            preserveAspectRatio="xMidYMid meet"
          />
        ))}

      {/* Texts (nested svg = clipping viewport per cell) */}
      {texts.map((t, i) => {
        let x = PAD_VALUE_LEFT;
        let textAnchor = "start";
        if (t.align === "right") {
          x = t.width - PAD_LABEL_RIGHT;
          textAnchor = "end";
        } else if (t.align === "center") {
          x = t.width / 2;
          textAnchor = "middle";
        }
        return (
          <svg
            key={i}
            x={t.x}
            y={t.y}
            width={t.width}
            height={t.height}
            style={{ pointerEvents: "none" }}
            {...(t.isPageNum ? { "data-page-number": true } : {})}
          >
            <text
              x={x}
              y={t.height / 2}
              dominantBaseline="central"
              textAnchor={textAnchor}
              fontFamily={fontFamily}
              fontSize={t.fontSize}
              fontWeight={t.kind === "label" ? 600 : t.bold ? 700 : 400}
              fill={t.kind === "label" ? labelColor : valueColor}
            >
              {t.text}
            </text>
          </svg>
        );
      })}
    </g>
  );
}
