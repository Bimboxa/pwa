import SvgIcon from "@mui/material/SvgIcon";

// Apartment floor plan: perimeter walls, room partitions and an entry door.
export default function IconFloorPlan(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d="M9 21H3V3h18v18h-7M3 11h6m3-8v8h9M15 14v7M7 3v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="miter"
      />
      <path
        d="M9 21v-5a5 5 0 0 1 5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </SvgIcon>
  );
}
