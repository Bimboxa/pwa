import SvgIcon from "@mui/material/SvgIcon";

const IconPolygonCircle = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Filled circle */}
    <circle
      cx="12"
      cy="12"
      r="9"
      fill="currentColor"
      opacity="0.25"
      stroke="currentColor"
      strokeWidth="2"
    />
    {/* Three points representing the 3-click circle definition */}
    <circle cx="12" cy="3" r="2.5" fill="currentColor" />
    <circle cx="4.5" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="19.5" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </SvgIcon>
);

export default IconPolygonCircle;
