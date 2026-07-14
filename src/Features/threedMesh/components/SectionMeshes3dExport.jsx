import { useState } from "react";

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { TableChart } from "@mui/icons-material";

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
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Maille</TableCell>
                <TableCell sx={{ fontWeight: "bold" }} align="right">
                  Surface
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }} align="right">
                  Nb faces
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Couleur</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.displayLabel}</TableCell>
                  <TableCell align="right">
                    {formatSurfaceM2(row.surface)}
                  </TableCell>
                  <TableCell align="right">{row.faces?.length ?? 0}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: "4px",
                        bgcolor: row.color,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
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
