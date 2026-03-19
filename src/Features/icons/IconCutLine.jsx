import SvgIcon from "@mui/material/SvgIcon";

const IconCutLine = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Left piece of polyline */}
    <polyline
      points="3,18 7,12 10,13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Right piece of polyline */}
    <polyline
      points="14,11 17,10 21,5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Vertical cut mark */}
    <line
      x1="12"
      y1="7"
      x2="12"
      y2="17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2"
    />

    {/* Cut gap indicator */}
    <line
      x1="10"
      y1="13"
      x2="14"
      y2="11"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.25"
    />
  </SvgIcon>
);

export default IconCutLine;
