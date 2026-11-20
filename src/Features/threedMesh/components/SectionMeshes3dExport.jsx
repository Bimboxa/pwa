import { useMemo, useState } from "react";

import { useSelector } from "react-redux";

import { selectMeshExportSuffixes } from "Features/scopeConfig/utils/scopeConfigSelectors";

import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { ContentCopy, Download, TableChart } from "@mui/icons-material";

import * as Excel from "exceljs";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import createSheetMeshes3d from "Features/excel/utils/createSheetMeshes3d";
import downloadBlob from "Features/files/utils/downloadBlob";

import DataExportItem from "./DataExportItem";
import expandMeshes3dRowsBySuffixes from "../utils/expandMeshes3dRowsBySuffixes";

// Mailles export card of the Export tool (PanelPrint, Maillage module),
// rendered inside a WhiteSectionGeneric: hover-reveal row opening the recap
// datagrid dialog or downloading the Excel export. `rows` are the mailles
// already decorated with `displayLabel` / `surfaceLabel`. The dialog offers
// the export suffixes of the scope configuration (P, I, S, F...) as a
// multi-toggle: one row per mesh and per active suffix (M-1-P, M-1-S, ...).
export default function SectionMeshes3dExport({ rows, surfaceDecimals }) {
  // data

  const suffixes = useSelector(selectMeshExportSuffixes);

  // state

  const [openDatagrid, setOpenDatagrid] = useState(false);
  const [selectedSuffixes, setSelectedSuffixes] = useState([]);

  // helpers

  // Configuration order, and suffixes removed from the configuration dropped.
  const activeSuffixes = useMemo(
    () => suffixes.filter((suffix) => selectedSuffixes.includes(suffix)),
    [suffixes, selectedSuffixes]
  );

  // What is displayed is what is copied / downloaded.
  const exportRows = useMemo(
    () => expandMeshes3dRowsBySuffixes(rows, activeSuffixes),
    [rows, activeSuffixes]
  );

  // handlers

  async function handleDownloadExcel() {
    const workbook = new Excel.Workbook();
    createSheetMeshes3d(workbook, exportRows, surfaceDecimals);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "maillage.xlsx");
  }

  // Same columns as the Excel export, TSV so it pastes as cells in Excel.
  function handleCopyToClipboard() {
    const factor = 10 ** surfaceDecimals;
    const header = "Maille\tSurface (m²)";
    const lines = exportRows.map((row) => {
      const surface = Math.round((row.surface ?? 0) * factor) / factor;
      return `${row.displayLabel}\t${String(surface).replace(".", ",")}`;
    });
    navigator.clipboard.writeText([header, ...lines].join("\n"));
  }

  // render

  return (
    <Box>
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 2,
            py: 0.5,
          }}
        >
          {suffixes.length > 0 ? (
            <ToggleButtonGroup
              size="small"
              value={activeSuffixes}
              onChange={(e, next) => setSelectedSuffixes(next)}
            >
              {suffixes.map((suffix) => (
                <ToggleButton
                  key={suffix}
                  value={suffix}
                  sx={{ py: 0.25, px: 1.25, minWidth: 32 }}
                >
                  {suffix}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          ) : (
            <Box />
          )}

          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title="Copier pour Excel">
              <IconButton size="small" onClick={handleCopyToClipboard}>
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Télécharger Excel">
              <IconButton size="small" onClick={handleDownloadExcel}>
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
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
              {exportRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.displayLabel}</TableCell>
                  <TableCell align="right">{row.surfaceLabel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}
