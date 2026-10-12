import { Box, Button, Tooltip, Typography } from "@mui/material";
import { SelectAll } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import {
  getAnnotationTemplateMainQtyKey,
  MESH_3D_QTY_LABEL,
} from "../utils/getAnnotationTemplateMainQtyLabel";
import {
  formatQtyValue,
  formatTemplateQtiesTooltip,
  getMesh3dQtiesNotice,
  getPaintedPartsCountLabel,
} from "../utils/mergePaintedQtiesIntoTemplateQties";

// ---------------------------------------------------------------------------
// Key quantities of one annotation template (right properties panel): the
// annotations count with a "Tout sélectionner" button, then one cell per
// relevant quantity (u / ml / m²). A quantity is relevant when it is the
// template's main quantity or when its total is > 0. Same aggregates and
// number format as the Dessin / Viewer panels (computeAnnotationTemplateQties
// + mergePaintedQtiesIntoTemplateQties).
// ---------------------------------------------------------------------------

function QtyCell({ value, unit, isMain, tooltip }) {
  const cell = (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
      <Typography
        variant="body2"
        sx={{
          fontFamily: "monospace",
          fontWeight: isMain ? 700 : 500,
          color: isMain ? "text.primary" : "text.secondary",
        }}
      >
        {value}
      </Typography>
      {unit && (
        <Typography
          variant="caption"
          sx={{ color: isMain ? "text.primary" : "text.secondary" }}
        >
          {unit}
        </Typography>
      )}
    </Box>
  );
  if (!tooltip) return cell;
  return <Tooltip title={tooltip}>{cell}</Tooltip>;
}

export default function SectionAnnotationTemplateKeyQties({
  annotationTemplate,
  qties,
  count = 0,
  onSelectAll,
}) {
  // strings

  const selectAllS = "Tout sélectionner";
  const countS =
    count === 0
      ? "Aucune annotation"
      : `${count} annotation${count > 1 ? "s" : ""}`;

  // helpers

  const mainQtyKey = getAnnotationTemplateMainQtyKey(annotationTemplate);
  const hasMesh3d = (qties?.mesh3dCount ?? 0) > 0;
  const unit = qties?.unit ?? 0;
  const length = qties?.length ?? 0;
  const surface = qties?.surface ?? 0;

  const showLength = mainQtyKey === "L" || length > 0;
  const showSurface = mainQtyKey === "S" || surface > 0;

  const paintedTooltip = formatTemplateQtiesTooltip(qties) ?? "";
  const paintedCountLabel = getPaintedPartsCountLabel(qties);

  // render

  const cells = (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 2,
        px: 0.5,
        pt: 0.5,
      }}
    >
      <QtyCell
        value={formatQtyValue(unit, 0)}
        unit="u"
        isMain={mainQtyKey === "U"}
      />

      {hasMesh3d ? (
        <QtyCell
          value={MESH_3D_QTY_LABEL}
          isMain={mainQtyKey !== "U"}
          tooltip={getMesh3dQtiesNotice(qties)}
        />
      ) : (
        <>
          {showLength && (
            <QtyCell
              value={formatQtyValue(length)}
              unit="ml"
              isMain={mainQtyKey === "L"}
            />
          )}
          {showSurface && (
            <QtyCell
              value={formatQtyValue(surface)}
              unit="m²"
              isMain={mainQtyKey === "S"}
            />
          )}
        </>
      )}

      {paintedCountLabel && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          · {paintedCountLabel}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{ px: 1, pt: 1 }}>
      <WhiteSectionGeneric>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" noWrap>
            {countS}
          </Typography>
          <Button
            size="small"
            startIcon={<SelectAll fontSize="small" />}
            onClick={onSelectAll}
            disabled={count === 0}
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              color: "text.primary",
              fontWeight: 600,
              textTransform: "none",
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {selectAllS}
          </Button>
        </Box>

        {paintedTooltip ? (
          <Tooltip title={paintedTooltip} placement="bottom-start">
            {cells}
          </Tooltip>
        ) : (
          cells
        )}
      </WhiteSectionGeneric>
    </Box>
  );
}
