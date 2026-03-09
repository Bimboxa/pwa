import SvgIcon from "@mui/material/SvgIcon";

const IconNewBaseMapVersion = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Back layer */}
    <rect
      x="5"
      y="3"
      width="14"
      height="11"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity="0.4"
    />
    {/* Front layer */}
    <rect
      x="3"
      y="6"
      width="14"
      height="11"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {/* Plus sign */}
    <line
      x1="19"
      y1="16"
      x2="19"
      y2="22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="16"
      y1="19"
      x2="22"
      y2="19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </SvgIcon>
);

export default IconNewBaseMapVersion;
