import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  requestMeshPaintFocus,
  setHighlightedMeshPaintId,
} from "Features/meshPaint/meshPaintSlice";
import { setToaster } from "Features/layout/layoutSlice";
import {
  selectSelectedItems,
  setSelectedItem,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";
import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import { selectLinkedListingSourceForSelectedScope } from "Features/listings/selectors/listingsSelectors";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import { Box, Typography } from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import RowTemplatePaintedPart from "Features/panelDrawing/components/RowTemplatePaintedPart";
import RowHostBrushAnnotation from "./RowHostBrushAnnotation";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useHostPaintedParts from "Features/meshPaint/hooks/useHostPaintedParts";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import useSelectAnnotationFromPanel from "Features/panelDrawing/hooks/useSelectAnnotationFromPanel";

import deleteMeshPaintsService from "Features/meshPaint/services/deleteMeshPaintsService";
import { formatQtyValue } from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// SectionAnnotationPaintedParts — « Parties peintes » of ONE host annotation
// (its properties panel): the faces / edges the « Pinceau » painted on it
// (db.meshPaints) and the 2D annotations the brush created on it instead,
// grouped by painting template (icon, label, "2 facettes · 12,40 m² · 1 arête
// · 3,20 ml"). A paint row click highlights + frames the paint in 3D (and a
// 3D click on a paint highlights its row here); the hover delete removes the
// paint. An annotation row click selects that annotation. Self-hiding
// without part.
// ---------------------------------------------------------------------------

const plural = (n, word, pluralWord = `${word}s`) =>
  `${n} ${n > 1 ? pluralWord : word}`;

export default function SectionAnnotationPaintedParts({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Parties peintes";
  const paintS = "Peinture 3D";
  const deleteErrorS = "Suppression de la peinture impossible";

  // data

  const { groups, count } = useHostPaintedParts(annotation);
  const spriteImage = useAnnotationSpriteImage();
  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const highlightedPaintId = useSelector(
    (s) => s.meshPaint?.highlightedPaintId ?? null
  );
  const selectedItems = useSelector(selectSelectedItems);
  const { isReadOnly: isReadOnlyScope } = useReadOnlyScope();
  // Paints made with a template of a listing linked from another scope are
  // read-only here (db guard on meshPaints.listingId).
  const linkedSourceByListingId = useSelector(
    selectLinkedListingSourceForSelectedScope
  );
  const selectAnnotationFromPanel = useSelectAnnotationFromPanel();

  // state

  const highlightedRowRef = useRef(null);
  // Highlight requested from THIS list (row click): the only one the list
  // drops when it unmounts — a 3D click on a paint sets the highlight while
  // the panels switch to the host, and must survive that switch.
  const ownHighlightRef = useRef(false);

  // helpers

  const selectedAnnotationId =
    selectedItems.length === 1 && selectedItems[0]?.type === "NODE"
      ? selectedItems[0].id
      : null;
  const isLinkedListing = (listingId) =>
    Boolean(
      listingId &&
      linkedSourceByListingId &&
      Object.prototype.hasOwnProperty.call(linkedSourceByListingId, listingId)
    );
  const canDelete = (part) =>
    !isReadOnlyScope && !isLinkedListing(part.listingId);

  const getSummary = (group) =>
    [
      group.facesCount > 0 && plural(group.facesCount, "facette"),
      group.edgesCount > 0 && plural(group.edgesCount, "arête"),
      group.linesCount > 0 && plural(group.linesCount, "ligne"),
      group.polygonsCount > 0 && plural(group.polygonsCount, "surface"),
      group.surface > 0 && `${formatQtyValue(group.surface)} m²`,
      group.length > 0 && `${formatQtyValue(group.length)} ml`,
    ]
      .filter(Boolean)
      .join(" · ");

  const getColor = (template) =>
    template?.fillColor ?? template?.strokeColor ?? "#999";

  // effects - the highlight lives only while this list is shown in 3D

  useEffect(() => {
    if (!isThreedEditor) dispatch(setHighlightedMeshPaintId(null));
  }, [isThreedEditor]);

  useEffect(() => {
    return () => {
      if (ownHighlightRef.current) dispatch(setHighlightedMeshPaintId(null));
    };
  }, []);

  // A paint clicked in 3D: its row scrolls into view.
  useEffect(() => {
    if (!highlightedPaintId) return;
    highlightedRowRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [highlightedPaintId]);

  // handlers

  const handleFocusPaint = (part) => {
    ownHighlightRef.current = true;
    dispatch(requestMeshPaintFocus(part.id));
  };

  const handleDeletePaint = async (part) => {
    try {
      await deleteMeshPaintsService({ ids: [part.id] });
      if (highlightedPaintId === part.id)
        dispatch(setHighlightedMeshPaintId(null));
    } catch (error) {
      console.error("[SectionAnnotationPaintedParts] delete", error);
      dispatch(
        setToaster({ message: error?.message || deleteErrorS, isError: true })
      );
    }
  };

  const handleSelectAnnotation = (a) => {
    if (!a) return;
    if (!isThreedEditor) {
      // 2D: select + zoom to it (same action as the panel's « Sélectionner »).
      selectAnnotationFromPanel(a);
      return;
    }
    // 3D: select only (no plan zoom, no main base map change).
    dispatch(
      setSelectedNode({
        nodeId: a.id,
        nodeType: "ANNOTATION",
        nodeListingId: a.listingId,
        annotationType: a.type,
        origin: "LISTING",
      })
    );
    dispatch(
      setSelectedItem({
        id: a.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        nodeId: a.id,
        annotationType: a.type,
        listingId: a.listingId,
        annotationTemplateId: a.annotationTemplateId,
      })
    );
    dispatch(setShowAnnotationsProperties(true));
  };

  // render

  if (count === 0) return null;

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
          {count}
        </Typography>
      </Box>

      {groups.map((group) => {
        const color = getColor(group.template);
        return (
          <Box key={group.templateId}>
            {/* Template header: icon + label + summary */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                bgcolor: "background.default",
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              {group.template && (
                <AnnotationTemplateIcon
                  template={group.template}
                  size={16}
                  spriteImage={spriteImage}
                />
              )}
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 600, minWidth: 0, flexShrink: 1 }}
              >
                {group.template?.label ?? "-?-"}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  ml: "auto",
                  fontFamily: "monospace",
                  color: "text.secondary",
                  flexShrink: 0,
                }}
              >
                {getSummary(group)}
              </Typography>
            </Box>

            <Box sx={{ bgcolor: "background.paper" }}>
              {group.parts.map((part) => (
                <Box
                  key={part.id}
                  ref={
                    highlightedPaintId === part.id ? highlightedRowRef : null
                  }
                  sx={{
                    "&:not(:last-child)": {
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    },
                  }}
                >
                  <RowTemplatePaintedPart
                    part={part}
                    label={paintS}
                    color={color}
                    isHighlighted={highlightedPaintId === part.id}
                    canFocus={isThreedEditor}
                    canDelete={canDelete(part)}
                    showBaseMapName={false}
                    onClick={handleFocusPaint}
                    onDelete={handleDeletePaint}
                  />
                </Box>
              ))}
              {group.annotations.map((a) => (
                <RowHostBrushAnnotation
                  key={a.id}
                  annotation={a}
                  template={group.template}
                  color={color}
                  isSelected={selectedAnnotationId === a.id}
                  onClick={handleSelectAnnotation}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
