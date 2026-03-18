import SvgIcon from "@mui/material/SvgIcon";

const IconCutSegment = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Left polyline piece: two points connected by a line */}
    <circle cx="4" cy="18" r="2" fill="currentColor" />
    <line
      x1="4"
      y1="16"
      x2="4"
      y2="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="4" cy="8" r="2" fill="currentColor" />

    {/* Removed segment in the middle: dashed line with scissors effect */}
    <line
      x1="4"
      y1="6"
      x2="12"
      y2="4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 2"
      opacity="0.35"
    />

    {/* Scissors / cut mark */}
    <line
      x1="6.5"
      y1="3"
      x2="9.5"
      y2="7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="9.5"
      y1="3"
      x2="6.5"
      y2="7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />

    {/* Right polyline piece: two points connected by a line */}
    <circle cx="14" cy="4" r="2" fill="currentColor" />
    <line
      x1="16"
      y1="4.5"
      x2="19"
      y2="8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="20" cy="9" r="2" fill="currentColor" />
  </SvgIcon>
);

export default IconCutSegment;
