import SvgIcon from "@mui/material/SvgIcon";

const IconPolygonRectangle = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <defs>
      <clipPath id="polygon-rect-clip">
        <rect x="3" y="3" width="18" height="18" rx="1" />
      </clipPath>
    </defs>
    {/* Hatching lines */}
    <g clipPath="url(#polygon-rect-clip)">
      <line x1="0" y1="9" x2="9" y2="0" stroke="currentColor" strokeWidth="1.2" />
      <line x1="0" y1="14" x2="14" y2="0" stroke="currentColor" strokeWidth="1.2" />
      <line x1="0" y1="19" x2="19" y2="0" stroke="currentColor" strokeWidth="1.2" />
      <line x1="0" y1="24" x2="24" y2="0" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5" y1="24" x2="24" y2="5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="10" y1="24" x2="24" y2="10" stroke="currentColor" strokeWidth="1.2" />
      <line x1="15" y1="24" x2="24" y2="15" stroke="currentColor" strokeWidth="1.2" />
    </g>
    {/* Dashed rectangle outline */}
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Top-left filled point (first click) */}
    <circle cx="3" cy="3" r="2.5" fill="currentColor" />
    {/* Bottom-right empty point (second click) */}
    <circle
      cx="21"
      cy="21"
      r="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </SvgIcon>
);

export default IconPolygonRectangle;
