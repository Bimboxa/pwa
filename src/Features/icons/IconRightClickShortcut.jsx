import SvgIcon from "@mui/material/SvgIcon";

// « Raccourci » (commands toolbar): a mouse with its RIGHT button filled,
// opening a small menu — the right-click shortcuts menu of the editors.
const IconRightClickShortcut = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Mouse body */}
    <rect
      x="3"
      y="3"
      width="10"
      height="18"
      rx="5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    {/* Buttons split: vertical middle line + horizontal line */}
    <line
      x1="8"
      y1="3.5"
      x2="8"
      y2="10"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="3.5"
      y1="10"
      x2="12.5"
      y2="10"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {/* Right button, filled */}
    <path
      d="M8.9 4.1 H9 a3.3 3.3 0 0 1 3.1 3.3 V9.1 H8.9 Z"
      fill="currentColor"
    />
    {/* Menu popping out of the right button */}
    <rect
      x="14"
      y="6"
      width="8"
      height="9"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="16"
      y1="8.6"
      x2="20"
      y2="8.6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <line
      x1="16"
      y1="10.6"
      x2="20"
      y2="10.6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <line
      x1="16"
      y1="12.6"
      x2="18.5"
      y2="12.6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </SvgIcon>
);

export default IconRightClickShortcut;
