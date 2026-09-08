import { useRef } from "react";

// Dashed "Logo" drop zone rendered in the logo slot of a title block when no
// logo is set. DOM content inside a <foreignObject>, so the hidden file input
// works from within the SVG. Shared by the page cartouche (PortfolioHeaderSvg)
// and the edit dialog (TitleBlockEditableSvg).
export default function TitleBlockLogoPlaceholder({
  slot,
  fontFamily,
  onFile,
}) {
  const inputRef = useRef(null);

  // handlers

  function handleChange(e) {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  // render

  if (!slot) return null;

  return (
    <foreignObject
      x={slot.x - 1}
      y={slot.y - 1}
      width={slot.width + 2}
      height={slot.height + 2}
    >
      <label
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          cursor: "pointer",
          border: "1.5px dashed #ccc",
          borderRadius: "3px",
          boxSizing: "border-box",
          background: "#fafafa",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="#bbb"
        >
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
        <span
          style={{
            fontSize: "7px",
            color: "#aaa",
            fontFamily: fontFamily || "sans-serif",
            marginTop: "1px",
          }}
        >
          Logo
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleChange}
        />
      </label>
    </foreignObject>
  );
}
