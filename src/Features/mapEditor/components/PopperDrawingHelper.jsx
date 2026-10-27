import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, IconButton, Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CloseIcon from "@mui/icons-material/Close";

import db from "App/db/db";

import SectionDrawingHelperContent from "./SectionDrawingHelperContent";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import useExitDrawingMode from "../hooks/useExitDrawingMode";
import useRelsBusinessObjectAnnotation from "Features/businessObjects/hooks/useRelsBusinessObjectAnnotation";
import selectLocatingBusinessObjectId from "Features/businessObjects/utils/selectLocatingBusinessObjectId";
import selectLinkBusinessObjectDraftId from "Features/businessObjects/utils/selectLinkBusinessObjectDraftId";
import selectDrawingHelperTitle from "../utils/selectDrawingHelperTitle";
import allowsMultipleLocationAnnotations from "Features/businessObjects/utils/allowsMultipleLocationAnnotations";
import { softGradientCardSx } from "Features/dashboard/utils/dashboardStyles";

// ---------------------------------------------------------------------------
// PopperDrawingHelper — floating panel shown while drawing
// ---------------------------------------------------------------------------

export default function PopperDrawingHelper() {
  // strings

  const drawS = "Mode dessin";
  const quitS = "Quitter le dessin";

  // data — "Localiser" draw (Ouvrages module): the draft carries the
  // LOCATE_BUSINESS_OBJECT interceptor; the header names the object and a
  // warning tells when its main annotation on this base map gets replaced
  // (single-location listings only: a listing allowing several main
  // annotations per base map adds the new one instead).

  // A LINK draw (regular template drawn while an object is active) names the
  // object too — the created annotation links to it, nothing is replaced.

  const locatingBusinessObjectId = useSelector(selectLocatingBusinessObjectId);
  const linkBusinessObjectId = useSelector(selectLinkBusinessObjectDraftId);
  const draftBusinessObjectId =
    locatingBusinessObjectId ?? linkBusinessObjectId;
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const draftBusinessObject = useLiveQuery(async () => {
    if (!draftBusinessObjectId) return null;
    const o = await db.businessObjects.get(draftBusinessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [draftBusinessObjectId, businessObjectsUpdatedAt]);
  const { value: locatingRels } = useRelsBusinessObjectAnnotation({
    businessObjectId: locatingBusinessObjectId,
  });
  const locatingListing = useSelector((s) =>
    draftBusinessObject?.listingId
      ? (s.listings.listingsById?.[draftBusinessObject.listingId] ?? null)
      : null
  );
  const multipleLocations = allowsMultipleLocationAnnotations(locatingListing);
  const replacesMainOnBaseMap =
    !multipleLocations &&
    (locatingRels ?? []).some(
      (r) => r.isMain && r.baseMapId === selectedBaseMapId
    );

  // Extruder / Déplacer / Tourner / Changer de style: the helper is titled
  // after the tool.
  const transformToolTitle = useSelector(selectDrawingHelperTitle);

  const titleS = draftBusinessObject
    ? locatingBusinessObjectId
      ? `Localiser — ${draftBusinessObject.label}`
      : `Ouvrage — ${draftBusinessObject.label}`
    : (transformToolTitle ?? drawS);

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // handlers

  // X: leaves the draw / tool and drops the annotation in progress (Escape
  // would commit it first).
  const exitDrawingMode = useExitDrawingMode();

  // render

  return (
    <Paper
      elevation={4}
      sx={(theme) => ({
        ...softGradientCardSx(theme.palette.secondary.main),
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: "fit-content",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      })}
    >
      {/* Drag handle header — the X stops the mousedown so it never drags */}
      <Box
        onMouseDown={handleMouseDown}
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 1,
          pr: 0.75,
          py: 0.5,
          borderBottom: `1px solid ${alpha(theme.palette.secondary.main, 0.18)}`,
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        })}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: "panel.textLight" }} />
        <Typography
          variant="body2"
          sx={{ flex: 1, fontWeight: 500, color: "panel.textMuted" }}
        >
          {titleS}
        </Typography>
        <IconButton
          size="small"
          title={quitS}
          aria-label={quitS}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={exitDrawingMode}
          sx={(theme) => ({
            color: "secondary.main",
            bgcolor: alpha(theme.palette.secondary.main, 0.1),
            "&:hover": { bgcolor: alpha(theme.palette.secondary.main, 0.22) },
          })}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {locatingBusinessObjectId && draftBusinessObject && (
        <Box sx={{ px: 1.5, pt: 1, display: "flex", flexDirection: "column" }}>
          <Typography variant="caption" color="text.secondary">
            L&apos;annotation dessinée devient l&apos;annotation principale de
            l&apos;ouvrage et porte son nom.
          </Typography>
          {replacesMainOnBaseMap && (
            <Typography variant="caption" color="warning.main">
              L&apos;ouvrage est déjà localisé sur ce plan : son annotation
              principale actuelle sera remplacée.
            </Typography>
          )}
          {multipleLocations && (
            <Typography variant="caption" color="text.secondary">
              Chaque dessin ajoute une annotation principale sur ce plan. Échap
              pour terminer.
            </Typography>
          )}
        </Box>
      )}

      <SectionDrawingHelperContent />
    </Paper>
  );
}
