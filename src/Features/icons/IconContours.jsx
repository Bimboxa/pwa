import SvgIcon from "@mui/material/SvgIcon";

const IconContours = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Inner wall (thick) */}
    <line x1="7" y1="5" x2="7" y2="19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
    {/* Left contour */}
    <line x1="4.5" y1="5" x2="4.5" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Right contour */}
    <line x1="9.5" y1="5" x2="9.5" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Top cap */}
    <line x1="4.5" y1="5" x2="9.5" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Bottom cap */}
    <line x1="4.5" y1="19" x2="9.5" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Horizontal wall (thick) */}
    <line x1="9.5" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
    {/* Top contour H */}
    <line x1="9.5" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Bottom contour H */}
    <line x1="9.5" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Right cap H */}
    <line x1="20" y1="10" x2="20" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </SvgIcon>
);

export default IconContours;
