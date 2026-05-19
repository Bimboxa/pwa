import SvgIcon from "@mui/material/SvgIcon";

const IconCurvature = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Solid arc from bottom-left to bottom-right, apex at top */}
    <path
      d="M 4.5 17 A 9 9 0 0 1 19.5 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* square endpoints + filled circle apex (S-C-S representation) */}
    <rect x="2.5" y="15" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="8" r="2.5" fill="currentColor" />
    <rect x="17.5" y="15" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </SvgIcon>
);

export default IconCurvature;
