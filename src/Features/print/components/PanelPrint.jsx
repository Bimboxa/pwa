import { useState, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setShowBgImageInMapEditor } from "Features/bgImage/bgImageSlice";
import { setShowPrintableMap } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  CircularProgress,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import {
  TableChart,
  Download,
  MenuBook,
  PictureAsPdf,
} from "@mui/icons-material";

import * as Excel from "exceljs";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import CardPortfolioList from "Features/portfolios/components/CardPortfolioList";
import DatagridAnnotations from "Features/annotations/components/DatagridAnnotations";
import DatagridAnnotationsAggregated from "Features/annotations/components/DatagridAnnotationsAggregated";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useDownladPdfReport from "Features/pdfReport/hooks/useDownladPdfReport";
import usePdfReportName from "Features/pdfReport/hooks/usePdfReportName";
import SliderBaseMapOpacity from "Features/mapEditor/components/SliderBaseMapOpacity";
import SwitchBaseMapGrayScale from "Features/mapEditor/components/SwitchBaseMapGrayScale";
import createSheetAnnotations from "Features/excel/utils/createSheetAnnotations";
import createSheetAnnotationsAggregated from "Features/excel/utils/createSheetAnnotationsAggregated";
import downloadBlob from "Features/files/utils/downloadBlob";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";
import editor from "App/editor";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

// --- MiniSwitch from old PanelExport ---
const MiniSwitch = styled(Switch)(({ theme }) => ({
  width: 26,
  height: 14,
  padding: 0,
  display: "flex",
  "& .MuiSwitch-switchBase": {
    padding: 2,
    "&.Mui-checked": {
      transform: "translateX(12px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        opacity: 1,
        backgroundColor: theme.palette.primary.main,
      },
    },
  },
  "& .MuiSwitch-thumb": {
    width: 10,
    height: 10,
    boxShadow: "none",
  },
  "& .MuiSwitch-track": {
    borderRadius: 16 / 2,
    opacity: 1,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,.35)"
        : "rgba(0,0,0,.25)",
    boxSizing: "border-box",
  },
}));

export default function PanelPrint() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const annotations = useAnnotationsV2({
    caller: "PanelPrint",
    filterByProjectId: projectId,
    withQties: true,
    withListingName: true,
    excludeIsForBaseMapsListings: true,
  });

  const layers = useLiveQuery(
    () => (projectId ? db.layers.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  );
  const layerById = useMemo(() => getItemsByKey(layers ?? [], "id"), [layers]);

  const enrichedAnnotations = useMemo(() => {
    if (!annotations) return [];
    return annotations.map((a) => ({
      ...a,
      layerName: a.layerId ? (layerById[a.layerId]?.name || "-") : "-",
    }));
  }, [annotations, layerById]);

  const totalAnnotations = enrichedAnnotations.length;

  // data - PDF export

  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const exportPdf = useDownladPdfReport();
  const pdfTitle = usePdfReportName();

  // state

  const [openDatagridAll, setOpenDatagridAll] = useState(false);
  const [openDatagridAggregated, setOpenDatagridAggregated] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // handlers - Excel

  async function handleDownloadExcelAll() {
    const workbook = new Excel.Workbook();
    createSheetAnnotations(workbook, enrichedAnnotations);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "annotations.xlsx");
  }

  async function handleDownloadExcelAggregated() {
    const workbook = new Excel.Workbook();
    createSheetAnnotationsAggregated(workbook, enrichedAnnotations);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "annotations-agregees.xlsx");
  }

  // handlers - PDF export

  function handleShowBgImageChange(show) {
    dispatch(setShowBgImageInMapEditor(show));
  }

  async function handleGeneratePdf() {
    setPdfLoading(true);
    dispatch(setShowPrintableMap(true));
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
    try {
      await exportPdf({
        svgElement: editor.printableMapSvgElement,
        name: pdfTitle,
        addTable: true,
      });
    } catch (error) {
      console.error(error);
    }
    dispatch(setShowPrintableMap(false));
    setPdfLoading(false);
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
          Export
        </Typography>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        {/* Card 1 — Annotations count */}
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Annotations
            </Typography>
            <Chip label={totalAnnotations} size="small" />
          </Box>
        </WhiteSectionGeneric>

        {/* Card 2 — Données */}
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 0.5,
            }}
          >
            <TableChart fontSize="small" color="action" />
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Données
            </Typography>
          </Box>

          {/* Item: Toutes les annotations */}
          <DataExportItem
            label="Toutes les annotations"
            onOpenDatagrid={() => setOpenDatagridAll(true)}
            onDownloadExcel={handleDownloadExcelAll}
          />

          {/* Item: Données agrégées */}
          <DataExportItem
            label="Données agrégées par modèle"
            onOpenDatagrid={() => setOpenDatagridAggregated(true)}
            onDownloadExcel={handleDownloadExcelAggregated}
          />
        </WhiteSectionGeneric>

        {/* Card 3 — Carnet de plans */}
        <CardPortfolioList />

        {/* Card 4 — Export PDF carte (hidden for now) */}
      </BoxFlexVStretch>

      {/* Dialog: Toutes les annotations */}
      <DialogGeneric
        title={`${totalAnnotations} annotation(s)`}
        open={openDatagridAll}
        onClose={() => setOpenDatagridAll(false)}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations
            annotations={enrichedAnnotations}
            showListingName
            showLayerName
          />
        </BoxFlexVStretch>
      </DialogGeneric>

      {/* Dialog: Données agrégées */}
      <DialogGeneric
        title="Données agrégées par modèle d'annotation"
        open={openDatagridAggregated}
        onClose={() => setOpenDatagridAggregated(false)}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotationsAggregated annotations={enrichedAnnotations} />
        </BoxFlexVStretch>
      </DialogGeneric>
    </BoxFlexVStretch>
  );
}

// --- Sub-component: hover-reveal export item ---

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
        <IconButton size="small" onClick={onOpenDatagrid} title="Voir le tableau">
          <TableChart fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onDownloadExcel} title="Télécharger Excel">
          <Download fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
