import IconOpeningBase from "./IconOpeningBase";

const PATH = "M 6 16.5 L 11 8.5 L 18 13.5";

// « Ouverture — Bande » (CUT_STRIP): a wide band following a drawn polyline
// (clicked points marked) is cut out of the surface.
const IconOpeningStrip = (props) => (
  <IconOpeningBase
    {...props}
    hole={
      <path
        d={PATH}
        fill="none"
        stroke="black"
        strokeWidth="6"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    }
    marks={
      <>
        <path
          d={PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="1.5 1.5"
        />
        <circle cx="6" cy="16.5" r="1.5" fill="currentColor" />
        <circle cx="11" cy="8.5" r="1.5" fill="currentColor" />
        <circle cx="18" cy="13.5" r="1.5" fill="currentColor" />
      </>
    }
  />
);

export default IconOpeningStrip;
