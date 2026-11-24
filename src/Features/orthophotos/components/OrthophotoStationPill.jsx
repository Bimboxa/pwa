import { Box } from "@mui/material";

const ACCENT = "#0d47a1";

// Label of a camera station ("P01"): a small white frame with a bold blue
// name, centred on the station point; filled while its orthophoto is the
// selected one. Screen-sized (drawn in the DOM layer of the stations).
export default function OrthophotoStationPill({
  name,
  active = false,
  draggable = false,
  // photo excluded in the tool (no longer taken into account)
  muted = false,
}) {
  // render

  return (
    <Box
      sx={{
        transform: "translate(-50%, -50%)",
        opacity: muted && !active ? 0.45 : 1,
        px: 0.75,
        height: 22,
        minWidth: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "4px",
        border: `1px solid ${active ? ACCENT : "rgba(0,0,0,0.12)"}`,
        bgcolor: active ? ACCENT : "common.white",
        color: active ? "common.white" : ACCENT,
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
        userSelect: "none",
        cursor: draggable ? "grab" : "pointer",
        "&:hover": { borderColor: ACCENT },
      }}
    >
      {name || "?"}
    </Box>
  );
}
