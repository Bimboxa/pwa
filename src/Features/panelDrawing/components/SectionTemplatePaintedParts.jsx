import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  requestMeshPaintFocus,
  setHighlightedMeshPaintId,
} from "Features/meshPaint/meshPaintSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { selectLinkedListingSourceForSelectedScope } from "Features/listings/selectors/listingsSelectors";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import { Box, Typography } from "@mui/material";

import RowTemplatePaintedPart from "./RowTemplatePaintedPart";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import deleteMeshPaintsService from "Features/meshPaint/services/deleteMeshPaintsService";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// SectionTemplatePaintedParts — « Parties peintes » of the template detail
// view (PanelTemplateAnnotations): the faces / edges painted with this
// template by the 3D brush (MESH_BRUSH). A row click highlights the part and
// frames it in 3D (meshPaint slice → 3D layer); the hover delete removes the
// paint (undoable). Counted parts first, then orphans / conflicts.
// ---------------------------------------------------------------------------

export default function SectionTemplatePaintedParts({
  parts,
  hostLabelById,
  color,
  readOnly,
  isAllScope,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Parties peintes";
  const deleteErrorS = "Suppression de la peinture impossible";

  // data

  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const highlightedPaintId = useSelector(
    (s) => s.meshPaint?.highlightedPaintId ?? null
  );
  const { isReadOnly: isReadOnlyScope } = useReadOnlyScope();
  // Paints made with a template of a listing linked from another scope are
  // read-only here (db guard on meshPaints.listingId).
  const linkedSourceByListingId = useSelector(
    selectLinkedListingSourceForSelectedScope
  );

  // helpers

  const getLabel = (part) =>
    hostLabelById?.[part.hostAnnotationId] ?? "Annotation";

  // Counted parts first; then base map ("Tous"), host label, paint order.
  const sortedParts = useMemo(
    () =>
      [...(parts ?? [])].sort((a, b) => {
        if (a.isCounted !== b.isCounted) return a.isCounted ? -1 : 1;
        if (isAllScope) {
          const byBaseMap = (a.baseMapName ?? "").localeCompare(
            b.baseMapName ?? ""
          );
          if (byBaseMap !== 0) return byBaseMap;
        }
        const byHost = (
          hostLabelById?.[a.hostAnnotationId] ?? ""
        ).localeCompare(hostLabelById?.[b.hostAnnotationId] ?? "", undefined, {
          numeric: true,
        });
        if (byHost !== 0) return byHost;
        return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
      }),
    [parts, hostLabelById, isAllScope]
  );

  const canDeleteBase = !readOnly && !isReadOnlyScope;
  const isLinkedListing = (listingId) =>
    Boolean(
      listingId &&
      linkedSourceByListingId &&
      Object.prototype.hasOwnProperty.call(linkedSourceByListingId, listingId)
    );

  // effects - the highlight lives only while this list is shown in 3D

  useEffect(() => {
    if (!isThreedEditor) dispatch(setHighlightedMeshPaintId(null));
  }, [isThreedEditor]);

  useEffect(() => {
    return () => {
      dispatch(setHighlightedMeshPaintId(null));
    };
  }, []);

  // handlers

  const handleFocus = (part) => {
    dispatch(requestMeshPaintFocus(part.id));
  };

  const handleDelete = async (part) => {
    try {
      await deleteMeshPaintsService({ ids: [part.id] });
      if (highlightedPaintId === part.id)
        dispatch(setHighlightedMeshPaintId(null));
    } catch (error) {
      console.error("[SectionTemplatePaintedParts] delete", error);
      dispatch(
        setToaster({ message: error?.message || deleteErrorS, isError: true })
      );
    }
  };

  // render

  if (sortedParts.length === 0) return null;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.5,
          py: 0.75,
          bgcolor: "panel.sectionBg",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "panel.border",
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, fontWeight: 700, minWidth: 0 }}
        >
          {titleS}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{
            fontFamily: "monospace",
            color: "text.secondary",
            flexShrink: 0,
          }}
        >
          {sortedParts.length}
        </Typography>
      </Box>
      <Box sx={{ bgcolor: "background.paper" }}>
        {sortedParts.map((part) => (
          <RowTemplatePaintedPart
            key={part.id}
            part={part}
            label={getLabel(part)}
            color={color}
            isHighlighted={highlightedPaintId === part.id}
            canFocus={isThreedEditor}
            canDelete={canDeleteBase && !isLinkedListing(part.listingId)}
            showBaseMapName={isAllScope}
            onClick={handleFocus}
            onDelete={handleDelete}
          />
        ))}
      </Box>
    </Box>
  );
}
