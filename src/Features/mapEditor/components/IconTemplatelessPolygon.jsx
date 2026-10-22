// ---------------------------------------------------------------------------
// IconTemplatelessPolygon — light grey irregular polygon, the row icon of the
// « Annotations sans modèle » rows (Dessin popper and docked Dessin panel):
// the mark of a shape drawn without template. Same 18px box as the template
// row icons.
// ---------------------------------------------------------------------------

export default function IconTemplatelessPolygon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      style={{ flexShrink: 0 }}
    >
      <polygon
        points="3,7 11,2 18,6 16,15 7,18 2,13"
        fill="#d0d0d0"
        stroke="#b8b8b8"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
