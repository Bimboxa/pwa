import SvgIcon from "@mui/material/SvgIcon";

// Section mark ("trait de coupe", BASE_MAP_LINK): the section line with its
// end ticks and the two view-direction arrows (observer below the line).
const IconSectionLine = (props) => (
  <SvgIcon {...props} viewBox="0 0 20 20">
    {/* section line with end ticks */}
    <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.5" />
    <line x1="2" y1="5" x2="2" y2="11" stroke="currentColor" strokeWidth="1.5" />
    <line
      x1="18"
      y1="5"
      x2="18"
      y2="11"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {/* view-direction arrows */}
    <path
      d="M5 16 L5 10 M3 12 L5 10 L7 12"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="M15 16 L15 10 M13 12 L15 10 L17 12"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </SvgIcon>
);

export default IconSectionLine;
