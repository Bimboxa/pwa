// Screen rendering of the double page border frame (computePageFrame
// output). Tagged data-portfolio-frame so the PDF export hides it before
// rasterizing the page (it is redrawn as vector content in the final pass).
export default function PortfolioPageFrameSvg({ frame }) {
  // render

  if (!frame) return null;

  return (
    <g data-portfolio-frame pointerEvents="none">
      {[frame.outer, frame.inner].map((rect, i) => (
        <rect
          key={i}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill="none"
          stroke={frame.color}
          strokeWidth={rect.strokeWidth}
        />
      ))}
    </g>
  );
}
