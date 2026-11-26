import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineBoundaryDetect = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Inked side of the frontier */}
    <path
      d="M 4 20.5 A 16.5 16.5 0 0 1 20.5 4 L 20.5 20.5 Z"
      fill="currentColor"
      opacity="0.25"
    />
    {/* Detected frontier */}
    <path
      d="M 4 20.5 A 16.5 16.5 0 0 1 20.5 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Region drawn by the user */}
    <path
      d="M 2.5 13 L 9 2.5 L 17 6 L 10 17 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeDasharray="2 1.5"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconPolylineBoundaryDetect;
