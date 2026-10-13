import { forwardRef, useImperativeHandle, useState } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import { Box, Paper, Typography } from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import MapTooltip from "Features/mapEditorGeneric/components/MapTooltip";
import { formatQtyValue } from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";
import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";

// Owns the hover tooltip state in a child component so that MainThreedEditor
// does not re-render on every pointermove. A re-render of MainThreedEditor
// triggers `useAutoLoadAnnotationsInThreedEditor` to invoke `loadAnnotations`
// (which destroys + recreates every annotation object), making the GLB
// disappear briefly and the hover highlight target stale.

const ThreedHoverTooltip = forwardRef((_, ref) => {
  const [state, setState] = useState({
    node: null,
    text: null,
    paint: null,
    x: 0,
    y: 0,
  });

  useImperativeHandle(
    ref,
    () => ({
      set: (node, x, y) => setState({ node, text: null, paint: null, x, y }),
      // Plain text tooltip (no annotation lookup) — e.g. the base map name
      // over a sheet of the 3D base maps grid.
      setText: (text, x, y) =>
        setState({ node: null, text, paint: null, x, y }),
      // Painted part (« Pinceau », db.meshPaints) under the cursor: the
      // painting template, the part's own quantity and its host.
      // paint: { paintId, partType, annotationTemplateId, hostAnnotationId,
      //          qties: { enabled, surface, length } | null }
      setPaint: (paint, x, y) =>
        setState({ node: null, text: null, paint, x, y }),
      clear: () =>
        setState((prev) =>
          prev.node === null && prev.text === null && prev.paint === null
            ? prev
            : { ...prev, node: null, text: null, paint: null }
        ),
    }),
    []
  );

  const annotations = useAnnotationsV2({
    caller: "ThreedHoverTooltip",
    enabled: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
  });
  // Painted parts only: the templates are not queried until one is hovered.
  const templates = useAnnotationTemplates({ skip: !state.paint });
  const spriteImage = useAnnotationSpriteImage();

  if (state.text) {
    return (
      <Paper
        elevation={3}
        sx={{
          position: "absolute",
          left: state.x,
          top: state.y,
          px: 1,
          py: 0.5,
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        <Typography variant="caption" noWrap>
          {state.text}
        </Typography>
      </Paper>
    );
  }

  if (state.paint) {
    return (
      <PaintTooltip
        paint={state.paint}
        templates={templates}
        annotations={annotations || []}
        spriteImage={spriteImage}
        x={state.x}
        y={state.y}
      />
    );
  }

  if (!state.node) return null;

  // node.partQties: the hover addresses ONE face / edge of a mesh annotation
  // — its own measures replace the annotation totals.
  return (
    <MapTooltip
      hoveredNode={state.node}
      annotations={annotations || []}
      x={state.x}
      y={state.y}
      qtiesOverride={state.node.partQties}
      qtiesOverrideType={state.node.partType}
    />
  );
});

export default ThreedHoverTooltip;

// Tooltip of a painted part: template icon + label (the PAINTING template),
// « Arête · 3,20 ml » / « Face · 12,40 m² », then the host's label.
function PaintTooltip({ paint, templates, annotations, spriteImage, x, y }) {
  // strings

  const faceS = "Face";
  const edgeS = "Arête";
  const paintedOnS = "peint sur";

  // helpers

  const template = (templates || []).find(
    (t) => t.id === paint.annotationTemplateId
  );
  const host = annotations.find((a) => a.id === paint.hostAnnotationId);
  const hostTemplateLabel =
    host?.annotationTemplateProps?.label || host?.templateLabel;
  const hostLabel =
    host?.label && host.label !== hostTemplateLabel
      ? host.label
      : hostTemplateLabel;

  const isEdge = paint.partType === MESH_PAINT_PART_TYPES.EDGE;
  const qties = paint.qties;
  const qtyS = !qties?.enabled
    ? null
    : isEdge
      ? `${formatQtyValue(qties.length)} ml`
      : `${formatQtyValue(qties.surface)} m²`;
  const partS = [isEdge ? edgeS : faceS, qtyS].filter(Boolean).join(" · ");

  // render

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        left: x,
        top: y,
        px: 1,
        py: 0.5,
        pointerEvents: "none",
        zIndex: 9999,
        bgcolor: "rgba(0, 0, 0, 0.8)",
        color: "white",
        maxWidth: 260,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {template && (
          <AnnotationTemplateIcon
            template={template}
            size={16}
            spriteImage={spriteImage}
          />
        )}
        <Typography
          variant="caption"
          noWrap
          sx={{ fontWeight: "bold", color: "#90caf9" }}
        >
          {template?.label ?? "-?-"}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{ display: "block", fontFamily: "monospace" }}
      >
        {partS}
      </Typography>
      {hostLabel && (
        <Typography
          variant="caption"
          noWrap
          sx={{ display: "block", opacity: 0.7 }}
        >
          {`${paintedOnS} ${hostLabel}`}
        </Typography>
      )}
    </Paper>
  );
}
