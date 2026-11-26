import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineHighlightVectorize = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Highlighter stroke */}
    <path
      d="M 5 17.5 L 13 11 L 19 5.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.25"
    />
    {/* Scattered pixels under the stroke */}
    <circle cx="6.5" cy="17.6" r="0.9" fill="currentColor" />
    <circle cx="9.2" cy="13.4" r="0.9" fill="currentColor" />
    <circle cx="11.8" cy="13.2" r="0.9" fill="currentColor" />
    <circle cx="15.6" cy="7.6" r="0.9" fill="currentColor" />
    <circle cx="17.2" cy="8.4" r="0.9" fill="currentColor" />
    {/* Fitted polyline */}
    <path
      d="M 4.5 18 L 13 11 L 19.5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconPolylineHighlightVectorize;
