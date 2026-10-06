import SvgIcon from "@mui/material/SvgIcon";

// « Isoler un segment / une face »: a polyline whose middle segment is cut
// off at both ends (two cut marks) and kept bold.
const IconIsolateSegment = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Left piece of polyline */}
    <polyline
      points="3,20 6,14 9,12.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.45"
    />

    {/* Isolated segment (bold) */}
    <line
      x1="9"
      y1="12.5"
      x2="15"
      y2="9.5"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />

    {/* Cut marks at both ends */}
    <line
      x1="8"
      y1="10"
      x2="10"
      y2="15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="14"
      y1="7"
      x2="16"
      y2="12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />

    {/* Right piece of polyline */}
    <polyline
      points="15,9.5 18,8 21,4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.45"
    />
  </SvgIcon>
);

export default IconIsolateSegment;
