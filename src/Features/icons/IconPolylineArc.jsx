import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineArc = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Dashed arc from bottom-left to bottom-right, apex at top */}
    <path
      d="M 4.5 17 A 9 9 0 0 1 19.5 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
    />
    {/* Three points representing the 3-click arc definition:
        endpoints as squares, apex as a filled circle */}
    <rect x="2.5" y="15" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="8" r="2.5" fill="currentColor" />
    <rect x="17.5" y="15" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </SvgIcon>
);

export default IconPolylineArc;
