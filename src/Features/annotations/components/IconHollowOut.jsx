import { SvgIcon } from "@mui/material";

// A solid shape carved by a dashed inner hole: the footprint of the visible
// annotations is punched out of the selected polygon (boolean difference).
export default function IconHollowOut(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* outer shape (the selected polygon) */}
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* punched hole (footprint of a visible annotation) */}
      <circle
        cx="12"
        cy="12"
        r="4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.5 1.8"
      />
    </SvgIcon>
  );
}
