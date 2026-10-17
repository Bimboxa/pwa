import IconOpeningBase from "./IconOpeningBase";

// « Ouverture — Bande (2 clics) » (CUT_STRIP_SEGMENT): a wide straight band
// between two clicked points is cut out of the surface.
const IconOpeningStripSegment = (props) => (
  <IconOpeningBase
    {...props}
    hole={
      <line
        x1="6.5"
        y1="16.5"
        x2="17.5"
        y2="7.5"
        stroke="black"
        strokeWidth="6"
        strokeLinecap="butt"
      />
    }
    marks={
      <>
        <line
          x1="6.5"
          y1="16.5"
          x2="17.5"
          y2="7.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="1.5 1.5"
        />
        <circle cx="6.5" cy="16.5" r="1.5" fill="currentColor" />
        <circle cx="17.5" cy="7.5" r="1.5" fill="currentColor" />
      </>
    }
  />
);

export default IconOpeningStripSegment;
