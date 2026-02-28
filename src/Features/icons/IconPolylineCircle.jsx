import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineCircle = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Dashed circle outline */}
    <circle
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
    />
    {/* Three points representing the 3-click circle definition */}
    <circle cx="12" cy="3" r="2.5" fill="currentColor" />
    <circle cx="4.5" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="19.5" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </SvgIcon>
);

export default IconPolylineCircle;
