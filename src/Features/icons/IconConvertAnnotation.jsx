import SvgIcon from "@mui/material/SvgIcon";

const IconConvertAnnotation = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Source shape: filled polygon (left) */}
    <polygon
      points="3,7 9,4 9,14 3,17"
      fill="currentColor"
      opacity="0.35"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Arrow */}
    <line
      x1="11"
      y1="11"
      x2="15"
      y2="11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <polyline
      points="13.5,8.5 16,11 13.5,13.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Target shape: polyline (right) */}
    <polyline
      points="17,7 21,4 21,14 17,17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconConvertAnnotation;
