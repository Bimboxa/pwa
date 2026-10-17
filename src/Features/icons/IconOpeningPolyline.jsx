import IconOpeningBase from "./IconOpeningBase";

const PATH = "M 6 16.5 L 11 8.5 L 18 13.5";

// « Ouverture — Polyligne » (CUT_POLYLINE): a thin slot following a drawn
// polyline (clicked points marked) is cut out of the surface.
const IconOpeningPolyline = (props) => (
  <IconOpeningBase
    {...props}
    hole={
      <path
        d={PATH}
        fill="none"
        stroke="black"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    }
    marks={
      <>
        <circle cx="6" cy="16.5" r="1.5" fill="currentColor" />
        <circle cx="11" cy="8.5" r="1.5" fill="currentColor" />
        <circle cx="18" cy="13.5" r="1.5" fill="currentColor" />
      </>
    }
  />
);

export default IconOpeningPolyline;
