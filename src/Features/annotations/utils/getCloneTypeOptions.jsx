import { SvgIcon } from "@mui/material";
import IconStrip from "Features/icons/IconStrip";

const polylineIcon = (
  <SvgIcon fontSize="small" viewBox="0 0 20 20">
    <line
      x1="2" y1="10" x2="18" y2="10"
      stroke="currentColor" strokeWidth="4" strokeLinecap="round"
    />
  </SvgIcon>
);

const polygonIcon = (
  <SvgIcon fontSize="small" viewBox="0 0 20 20">
    <rect x="2" y="3" width="16" height="14" rx="2" fill="currentColor" />
  </SvgIcon>
);

const stripIcon = <IconStrip fontSize="small" />;

const OPTIONS = {
  POLYLINE: { key: "POLYLINE", label: "Ligne", icon: polylineIcon },
  POLYGON: { key: "POLYGON", label: "Surface", icon: polygonIcon },
  STRIP: { key: "STRIP", label: "Bande", icon: stripIcon },
};

const TYPE_OPTIONS_MAP = {
  POLYLINE: [OPTIONS.POLYLINE, OPTIONS.STRIP],
  POLYGON: [OPTIONS.POLYGON, OPTIONS.STRIP],
  STRIP: [OPTIONS.STRIP, OPTIONS.POLYLINE, OPTIONS.POLYGON],
};

export default function getCloneTypeOptions(sourceType) {
  return TYPE_OPTIONS_MAP[sourceType] ?? null;
}
