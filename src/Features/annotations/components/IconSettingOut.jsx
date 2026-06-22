import { SvgIcon } from "@mui/material";

// Custom icon for "Calepiner" (setting out): a bent polyline with regularly
// spaced filled points along it.
export default function IconSettingOut(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Polyline path */}
      <polyline
        points="3,18 9,6 15,6 21,16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Regularly spaced setting-out points */}
      <circle cx="3" cy="18" r="1.7" fill="currentColor" />
      <circle cx="6" cy="12" r="1.7" fill="currentColor" />
      <circle cx="9" cy="6" r="1.7" fill="currentColor" />
      <circle cx="12" cy="6" r="1.7" fill="currentColor" />
      <circle cx="15" cy="6" r="1.7" fill="currentColor" />
      <circle cx="18" cy="11" r="1.7" fill="currentColor" />
      <circle cx="21" cy="16" r="1.7" fill="currentColor" />
    </SvgIcon>
  );
}
