import { forwardRef } from "react";

const EmptyContainerPlaceholder = forwardRef(function EmptyContainerPlaceholder(
  { width, height, onMouseEnter, onMouseLeave },
  ref
) {
  // render

  return (
    <g
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={4}
        y={4}
        width={width - 8}
        height={height - 8}
        fill="none"
        stroke="#ccc"
        strokeWidth={2}
        strokeDasharray="8 4"
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#aaa"
        fontSize={14}
        fontFamily="sans-serif"
      >
        + Ajouter un fond de plan
      </text>
    </g>
  );
});

export default EmptyContainerPlaceholder;
