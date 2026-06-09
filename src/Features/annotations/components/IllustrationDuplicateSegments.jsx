// Illustration of the "Copie simple" option: the selected contour segments are
// duplicated as a plain polyline (no wall extrusion).
const STROKE = "#1976d2";

export default function IllustrationDuplicateSegments({ width = "100%" }) {
  return (
    <svg
      viewBox="0 0 160 100"
      width={width}
      role="img"
      aria-label="Copie simple"
    >
      {/* ghost of the source contour */}
      <polyline
        points="20,60 60,35 100,50 140,28"
        fill="none"
        stroke="#bdbdbd"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the duplicated polyline */}
      <polyline
        points="20,75 60,50 100,65 140,43"
        fill="none"
        stroke={STROKE}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
