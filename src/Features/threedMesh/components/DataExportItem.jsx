import { Box, IconButton, Typography } from "@mui/material";
import { TableChart, Download } from "@mui/icons-material";

// Hover-reveal export row (same recipe as PanelPrint): label + datagrid /
// Excel action icons revealed on hover.
export default function DataExportItem({
  label,
  onOpenDatagrid,
  onDownloadExcel,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 0.75,
        px: 0.5,
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
        "&:hover .export-actions": { opacity: 1 },
      }}
    >
      <Typography variant="body2">{label}</Typography>
      <Box
        className="export-actions"
        sx={{
          opacity: 0,
          display: "flex",
          gap: 0.5,
          transition: "opacity 0.15s",
        }}
      >
        <IconButton
          size="small"
          onClick={onOpenDatagrid}
          title="Voir le tableau"
        >
          <TableChart fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={onDownloadExcel}
          title="Télécharger Excel"
        >
          <Download fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
