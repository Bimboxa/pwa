import SvgIcon from "@mui/material/SvgIcon";

// Icon of the SCOPE module (the scope overview — "Krto" / "plan de
// repérage"): a plan sheet with its walls faded to the background, and the
// marks drawn on top of it at full strength — a segment with its two round
// vertices, and a circle annotation. The contrast between the two layers is
// the whole point: what the module is about is what was DRAWN on the plan.
const IconAnnotatedPlan = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* the plan underneath: sheet + one wall angle */}
    <g fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.5}>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="2.5" />
      <path d="M12 2.75V12h9.25" />
    </g>
    {/* the marks drawn on it */}
    <path
      d="M6 18L12.5 11.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <circle cx="6" cy="18" r="1.9" />
    <circle cx="12.5" cy="11.5" r="1.9" />
    <circle
      cx="17.2"
      cy="17.2"
      r="2.7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    />
  </SvgIcon>
);

export default IconAnnotatedPlan;
