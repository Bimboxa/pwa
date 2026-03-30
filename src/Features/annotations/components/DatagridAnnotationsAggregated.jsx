import { useMemo } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

const formatNumber = (value, unit) => {
  if (value === null || value === undefined || isNaN(value)) return "-";
  value = Number(value);
  return `${value.toFixed(2)} ${unit}`;
};

export default function DatagridAnnotationsAggregated({ annotations }) {
  // data

  const spriteImage = useAnnotationSpriteImage();

  const rows = useMemo(() => {
    if (!annotations) return [];

    const grouped = {};
    for (const annotation of annotations) {
      const templateId = annotation.annotationTemplateId;
      if (!templateId) continue;

      if (!grouped[templateId]) {
        grouped[templateId] = {
          id: templateId,
          templateLabel:
            annotation.annotationTemplateProps?.label || "Sans Label",
          listingNames: new Set(),
          baseMapNames: new Set(),
          layerNames: new Set(),
          height: annotation.height ?? 0,
          unit: 0,
          length: 0,
          surface: 0,
          // Template visual props (from first annotation in group)
          type: annotation.type,
          fillColor: annotation.fillColor,
          strokeColor: annotation.strokeColor,
          fillOpacity: annotation.fillOpacity,
          strokeOpacity: annotation.strokeOpacity,
          fillType: annotation.fillType,
          variant: annotation.variant,
          iconKey: annotation.iconKey,
          image: annotation.image,
        };
      }

      const row = grouped[templateId];
      row.unit += 1;
      if (annotation.listingName) row.listingNames.add(annotation.listingName);
      if (annotation.baseMapName) row.baseMapNames.add(annotation.baseMapName);
      if (annotation.layerName) row.layerNames.add(annotation.layerName);

      if (annotation.qties?.enabled) {
        if (Number.isFinite(annotation.qties.length))
          row.length += annotation.qties.length;
        if (Number.isFinite(annotation.qties.surface))
          row.surface += annotation.qties.surface;
      }
    }

    return Object.values(grouped).map((row) => ({
      ...row,
      listingName: [...row.listingNames].join(", "),
      baseMapName: [...row.baseMapNames].join(", "),
      layerName: [...row.layerNames].join(", "),
    }));
  }, [annotations]);

  // columns

  const columns = useMemo(
    () => [
      {
        field: "icon",
        headerName: "",
        width: 50,
        align: "center",
        headerAlign: "center",
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 1 }}>
            <AnnotationTemplateIcon template={params.row} size={20} spriteImage={spriteImage} />
          </Box>
        ),
      },
      {
        field: "listingName",
        headerName: "Liste",
        flex: 1,
        minWidth: 120,
      },
      {
        field: "baseMapName",
        headerName: "Fond de plan",
        flex: 1,
        minWidth: 120,
      },
      { field: "layerName", headerName: "Calque", flex: 1, minWidth: 120 },
      {
        field: "templateLabel",
        headerName: "Modèle",
        flex: 1,
        minWidth: 150,
      },
      {
        field: "height",
        headerName: "Hauteur",
        width: 120,
        type: "number",
        valueFormatter: (value) => formatNumber(value, "m"),
      },
      {
        field: "unit",
        headerName: "Unité",
        width: 100,
        type: "number",
      },
      {
        field: "length",
        headerName: "Longueur",
        width: 120,
        type: "number",
        valueFormatter: (value) => formatNumber(value, "m"),
      },
      {
        field: "surface",
        headerName: "Surface",
        width: 120,
        type: "number",
        valueFormatter: (value) => formatNumber(value, "m²"),
      },
    ],
    [spriteImage]
  );

  // handlers

  function handleCopyToClipboard() {
    const dataColumns = columns.filter((col) => col.field !== "icon");
    const headers = dataColumns.map((col) => col.headerName || col.field);
    const lines = rows.map((row) =>
      dataColumns
        .map((col) => {
          const value = row[col.field];
          if (value === null || value === undefined) return "";
          if (typeof value === "number") {
            return isNaN(value) ? "" : String(value).replace(".", ",");
          }
          return value;
        })
        .join("\t")
    );
    const tsv = [headers.join("\t"), ...lines].join("\n");
    navigator.clipboard.writeText(tsv);
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "flex-end", p: 0.5 }}>
        <Tooltip title="Copier">
          <IconButton size="small" onClick={handleCopyToClipboard}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <DataGridPro
        density="compact"
        rows={rows}
        columns={columns}
        sx={{
          border: "none",
          "& .MuiDataGrid-row": {
            bgcolor: "white",
            borderBottom: "1px solid #f0f0f0",
          },
          "& .MuiDataGrid-row:hover": {
            bgcolor: "#fafafa",
          },
          "& .MuiDataGrid-cell:focus": {
            outline: "none",
          },
        }}
      />
    </BoxFlexVStretch>
  );
}
