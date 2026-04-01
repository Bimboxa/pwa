import SvgIcon from "@mui/material/SvgIcon";

const IconVectorisation = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Letter T rotated 90° clockwise */}
    <line
      x1="5"
      y1="12"
      x2="19"
      y2="12"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <line
      x1="5"
      y1="6"
      x2="5"
      y2="18"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    <circle cx="5" cy="6" r="1.8" fill="currentColor" />
    <circle cx="5" cy="18" r="1.8" fill="currentColor" />
  </SvgIcon>
);

export default IconVectorisation;
