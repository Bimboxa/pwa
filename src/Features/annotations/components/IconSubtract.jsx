import { SvgIcon } from "@mui/material";

// Two overlapping shapes: the front (dashed) shape is "subtracted" from the
// back (solid) shape, leaving a notch where they overlap. A minus glyph in the
// overlap reinforces the boolean-subtraction meaning.
export default function IconSubtract(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* back shape (the source being carved) */}
      <rect
        x="3"
        y="3"
        width="12"
        height="12"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* front shape (the subtracted target) */}
      <rect
        x="9"
        y="9"
        width="12"
        height="12"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.5 1.8"
      />
      {/* minus glyph in the overlap */}
      <line
        x1="9.8"
        y1="12"
        x2="14.2"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
