import SvgIcon from "@mui/material/SvgIcon";

// Custom icons for the per-base-map annotation display toggle in the 3D
// "Fond de plan" panel. Each depicts the same polygon annotation in one of the
// three display states: hidden / normal / dimmed (transparent grey).

// A simple quad polygon used as the common annotation glyph.
const POLY_POINTS = "5,8 19,5 18,18 7,16";

// "NONE" — polygon outline crossed out.
export const IconAnnotationsHidden = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points={POLY_POINTS}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      opacity="0.5"
    />
    <line
      x1="3.5"
      y1="20.5"
      x2="20.5"
      y2="3.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </SvgIcon>
);

// "NORMAL" — solid filled polygon.
export const IconAnnotationsNormal = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points={POLY_POINTS}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

// "DIMMED" — translucent fill + dashed outline, evoking the grey ghost render.
export const IconAnnotationsDimmed = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points={POLY_POINTS}
      fill="currentColor"
      fillOpacity="0.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeDasharray="3 2"
    />
  </SvgIcon>
);
