import { useState } from "react";

import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { ContentCopy, TableChart } from "@mui/icons-material";

import * as Excel from "exceljs";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import createSheetMeshes3d from "Features/excel/utils/createSheetMeshes3d";
import downloadBlob from "Features/files/utils/downloadBlob";

import DataExportItem from "./DataExportItem";
import formatSurfaceM2 from "../utils/formatSurfaceM2";

// Export section of the mailles drawer: hover-reveal row opening the recap
// datagrid dialog or downloading the Excel export. `rows` are the mailles
// already decorated with `displayLabel`.
export default function SectionMeshes3dExport({ rows }) {
  // state

  const [openDatagrid, setOpenDatagrid] = useState(false);

  // handlers

  async function handleDownloadExcel() {
    const workbook = new Excel.Workbook();
    createSheetMeshes3d(workbook, rows);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "maillage.xlsx");
  }

  // Same columns as the Excel export, TSV so it pastes as cells in Excel.
  function handleCopyToClipboard() {
    const header = "Maille\tSurface (m²)";
    const lines = rows.map((row) => {
      const surface = Math.round((row.surface ?? 0) * 100) / 100;
      return `${row.displayLabel}\t${String(surface).replace(".", ",")}`;
    });
    navigator.clipboard.writeText([header, ...lines].join("\n"));
  }

  // render

  return (
    <Box sx={{ borderTop: "1px solid", borderColor: "divider", p: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <TableChart fontSize="small" color="action" />
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Export
        </Typography>
      </Box>

      <DataExportItem
        label="Tableau des mailles"
        onOpenDatagrid={() => setOpenDatagrid(true)}
        onDownloadExcel={handleDownloadExcel}
      />

      {/* Dialog: mailles recap table */}
      <DialogGeneric
        title={`${rows.length} maille(s)`}
        open={openDatagrid}
        onClose={() => setOpenDatagrid(false)}
        vw="50"
        vh="70"
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end", p: 0.5 }}>
          <Tooltip title="Copier pour Excel">
            <IconButton size="small" onClick={handleCopyToClipboard}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Maille</TableCell>
                <TableCell sx={{ fontWeight: "bold" }} align="right">
                  Surface
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.displayLabel}</TableCell>
                  <TableCell align="right">
                    {formatSurfaceM2(row.surface)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}
