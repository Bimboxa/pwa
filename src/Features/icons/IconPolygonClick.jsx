import SvgIcon from "@mui/material/SvgIcon";

const IconPolygonClick = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Bottom-left filled point */}
    <circle cx="5" cy="20" r="2.5" fill="currentColor" />
    {/* Solid vertical line */}
    <line
      x1="5"
      y1="17.5"
      x2="5"
      y2="6.5"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Top-left filled point */}
    <circle cx="5" cy="4" r="2.5" fill="currentColor" />
    {/* Dashed horizontal line */}
    <line
      x1="7.5"
      y1="4"
      x2="16"
      y2="4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2.5"
    />
    {/* Right empty circle point */}
    <circle
      cx="19"
      cy="4"
      r="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {/* Hatching lines from vertical line to empty circle */}
    <line x1="5" y1="8" x2="17.5" y2="4.5" stroke="currentColor" strokeWidth="1" />
    <line x1="5" y1="11.5" x2="18" y2="5" stroke="currentColor" strokeWidth="1" />
    <line x1="5" y1="15" x2="18.5" y2="5.5" stroke="currentColor" strokeWidth="1" />
    <line x1="5.5" y1="18.5" x2="19" y2="6" stroke="currentColor" strokeWidth="1" />
  </SvgIcon>
);

export default IconPolygonClick;
