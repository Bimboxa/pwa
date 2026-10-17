import IconOpeningBase from "./IconOpeningBase";

// « Ouverture — Cercle » (CUT_CIRCLE): a disc cut out of the surface, centre
// and radius point marked.
const IconOpeningCircle = (props) => (
  <IconOpeningBase
    {...props}
    hole={<circle cx="12" cy="12" r="5" fill="black" />}
    marks={
      <>
        <circle
          cx="12"
          cy="12"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" />
        <circle cx="17" cy="12" r="1.5" fill="currentColor" />
      </>
    }
  />
);

export default IconOpeningCircle;
