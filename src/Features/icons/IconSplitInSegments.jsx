import SvgIcon from "@mui/material/SvgIcon";

const IconSplitInSegments = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Segment 1 */}
    <line x1="3" y1="19" x2="7" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Segment 2 */}
    <line x1="9" y1="11" x2="15" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Segment 3 */}
    <line x1="17" y1="7" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Split indicators (dots at break points) */}
    <circle cx="7" cy="13" r="1.5" fill="currentColor" />
    <circle cx="9" cy="11" r="1.5" fill="currentColor" />
    <circle cx="15" cy="9" r="1.5" fill="currentColor" />
    <circle cx="17" cy="7" r="1.5" fill="currentColor" />
  </SvgIcon>
);

export default IconSplitInSegments;
