import { SvgIcon } from "@mui/material";

// Right-triangle "slope wall" glyph: a sloped hypotenuse (the ramp) with a
// filled side wall standing on it.
export default function IconSlopeWall(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* baseline */}
      <line
        x1="3"
        y1="20"
        x2="21"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* ramp (hypotenuse) */}
      <line
        x1="3"
        y1="20"
        x2="21"
        y2="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* left vertical wall */}
      <line
        x1="3"
        y1="20"
        x2="3"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* wall top */}
      <line
        x1="3"
        y1="9"
        x2="13"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
