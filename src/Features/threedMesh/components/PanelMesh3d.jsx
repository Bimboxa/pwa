import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setHideMeshes3d } from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { TableChart, Download, GridOn } from "@mui/icons-material";

import * as Excel from "exceljs";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import createSheetMeshes3d from "Features/excel/utils/createSheetMeshes3d";
import downloadBlob from "Features/files/utils/downloadBlob";

import useMeshes3d from "../hooks/useMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";

// Right panel "Maillage" (key MESH): numbering prefix setting + export of the
// mailles recap table (datagrid dialog + Excel). Mirrors PanelPrint's layout
// (WhiteSectionGeneric cards, hover-reveal export row).
export default function PanelMesh3d() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const hideMeshes3d = useSelector((s) => s.threedEditor.hideMeshes3d);

  const meshes3d = useMeshes3d({ projectId, scopeId });
  const { prefix, setPrefix } = useMesh3dLabelPrefix();

  const sorted = [...(meshes3d || [])].sort(
    (m1, m2) => (m1.number || 0) - (m2.number || 0)
  );
  const rows = sorted.map((mesh3d) => ({
    ...mesh3d,
    displayLabel: getMesh3dDisplayLabel(mesh3d, prefix),
  }));

  // state

  const [openDatagrid, setOpenDatagrid] = useState(false);

  // handlers

  function handlePrefixChange(e) {
    setPrefix(e.target.value);
  }

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
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box sx={{ p: 0.5, pl: 2 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{
            fontStyle: "italic",
            fontSize: (theme) => theme.typography.caption.fontSize,
          }}
        >
          Module
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Maillage
        </Typography>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        {/* Card 0 — Mailles count + visibility */}
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <GridOn fontSize="small" color="action" />
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                Mailles
              </Typography>
            </Box>
            <Chip label={rows.length} size="small" />
          </Box>
          <FormControlLabel
            sx={{ mt: 0.5, ml: 0 }}
            control={
              <Switch
                size="small"
                checked={hideMeshes3d}
                onChange={(e) => dispatch(setHideMeshes3d(e.target.checked))}
              />
            }
            label={<Typography variant="body2">Masquer les mailles</Typography>}
          />
        </WhiteSectionGeneric>

        {/* Card 1 — Numérotation */}
        <WhiteSectionGeneric>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            Numérotation
          </Typography>
          <TextField
            label="Préfixe"
            size="small"
            fullWidth
            value={prefix}
            onChange={handlePrefixChange}
            helperText={`Aperçu : ${prefix}1, ${prefix}2, …`}
          />
        </WhiteSectionGeneric>

        {/* Card 2 — Export */}
        <WhiteSectionGeneric>
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
        </WhiteSectionGeneric>
      </BoxFlexVStretch>

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
    </BoxFlexVStretch>
  );
}

// --- Sub-component: hover-reveal export item (same recipe as PanelPrint) ---

function DataExportItem({ label, onOpenDatagrid, onDownloadExcel }) {
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
