import SvgIcon from "@mui/material/SvgIcon";

const IconCutSegment = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Left piece of polyline */}
    <polyline
      points="3,20 6,14 10,12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Removed segment (dashed gap) */}
    <line
      x1="10"
      y1="12"
      x2="14"
      y2="10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 2"
      opacity="0.3"
    />

    {/* X mark on removed segment */}
    <line x1="10.5" y1="9" x2="13.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="13.5" y1="9" x2="10.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

    {/* Right piece of polyline */}
    <polyline
      points="14,10 18,8 21,4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconCutSegment;
