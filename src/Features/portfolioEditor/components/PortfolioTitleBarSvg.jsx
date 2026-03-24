const FONT_FAMILY = "sans-serif";

export default function PortfolioTitleBarSvg({
  titleBar,
  portfolioName,
  pageName,
}) {
  if (!titleBar) return null;

  const text = [portfolioName, pageName].filter(Boolean).join(" \u00B7 ");

  return (
    <g style={{ pointerEvents: "none" }}>
      <foreignObject
        x={titleBar.x}
        y={titleBar.y}
        width={titleBar.width}
        height={titleBar.height}
        style={{ overflow: "visible", pointerEvents: "none" }}
      >
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: "14px",
            fontWeight: 700,
            color: "#333",
            display: "flex",
            alignItems: "center",
            height: "100%",
            paddingLeft: "12px",
            boxSizing: "border-box",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {text || "\u00A0"}
        </div>
      </foreignObject>
    </g>
  );
}
