import { useMemo, useState } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useTemplateRankById from "Features/annotations/hooks/useTemplateRankById";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SwitchGeneric from "Features/layout/components/SwitchGeneric";
import getAggregatedAnnotationRows from "Features/annotations/utils/getAggregatedAnnotationRows";

const formatNumber = (value, unit) => {
  if (value === null || value === undefined || isNaN(value)) return "-";
  value = Number(value);
  return `${value.toFixed(2)} ${unit}`;
};

export default function DatagridAnnotationsAggregated({ annotations }) {
  // strings

  const globalAggregationS = "Agrégation globale";
  const multipleHeightsS = "Hauteurs multiples";

  // state

  const [globalAggregation, setGlobalAggregation] = useState(true);

  // data

  const spriteImage = useAnnotationSpriteImage();
  const templateRankById = useTemplateRankById();

  const rows = useMemo(
    () =>
      getAggregatedAnnotationRows({
        annotations,
        splitByContext: !globalAggregation,
        templateRankById,
      }),
    [annotations, globalAggregation, templateRankById]
  );

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
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: 1,
            }}
          >
            <AnnotationTemplateIcon
              template={params.row}
              size={20}
              spriteImage={spriteImage}
            />
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
        width: 160,
        type: "number",
        renderCell: (params) =>
          params.row.hasMultipleHeights ? (
            <Chip size="small" label={multipleHeightsS} />
          ) : (
            formatNumber(params.row.height, "m")
          ),
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
          if (col.field === "height" && row.hasMultipleHeights) {
            return multipleHeightsS;
          }
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 0.5,
        }}
      >
        <SwitchGeneric
          checked={globalAggregation}
          onChange={setGlobalAggregation}
          label={globalAggregationS}
        />
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
