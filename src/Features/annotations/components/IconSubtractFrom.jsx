import { SvgIcon } from "@mui/material";

// Anti-symmetric twin of IconSubtract: the same two overlapping shapes and the
// same minus glyph in the overlap, but the composition is mirrored across the
// vertical axis AND the stroke styles are swapped. In IconSubtract the solid
// shape is the annotation being carved and the dashed one is what gets picked;
// here it is the reverse — the SOLID shape is this annotation (the one being
// subtracted) and the DASHED shape stands for the annotations it is carved out
// of.
export default function IconSubtractFrom(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* the annotations being carved (picked on the map) */}
      <rect
        x="3"
        y="9"
        width="12"
        height="12"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.5 1.8"
      />
      {/* this annotation (the one subtracted) */}
      <rect
        x="9"
        y="3"
        width="12"
        height="12"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
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
