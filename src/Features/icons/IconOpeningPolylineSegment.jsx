import IconOpeningBase from "./IconOpeningBase";

// « Ouverture — Polyligne (2 clics) » (CUT_POLYLINE_SEGMENT): a thin straight
// slot between two clicked points is cut out of the surface.
const IconOpeningPolylineSegment = (props) => (
  <IconOpeningBase
    {...props}
    hole={
      <line
        x1="7"
        y1="16.5"
        x2="17"
        y2="7.5"
        stroke="black"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    }
    marks={
      <>
        <circle cx="7" cy="16.5" r="1.5" fill="currentColor" />
        <circle cx="17" cy="7.5" r="1.5" fill="currentColor" />
      </>
    }
  />
);

export default IconOpeningPolylineSegment;
