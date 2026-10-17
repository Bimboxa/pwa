import IconOpeningBase from "./IconOpeningBase";

// « Ouverture — Rectangle » (CUT_RECTANGLE): a rectangle cut out of the
// surface, two opposite corners marked (the two clicks).
const IconOpeningRectangle = (props) => (
  <IconOpeningBase
    {...props}
    hole={<rect x="7" y="8" width="10" height="8" fill="black" />}
    marks={
      <>
        <rect
          x="7"
          y="8"
          width="10"
          height="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="7" cy="8" r="1.5" fill="currentColor" />
        <circle cx="17" cy="16" r="1.5" fill="currentColor" />
      </>
    }
  />
);

export default IconOpeningRectangle;
