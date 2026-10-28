import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setLinkingBusinessObjectId } from "../businessObjectsSlice";

import { Box, IconButton, Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CloseIcon from "@mui/icons-material/Close";

import db from "App/db/db";

import IconAnnotationLinkAdd from "Features/icons/IconAnnotationLinkAdd";
import IconAnnotationLinkRemove from "Features/icons/IconAnnotationLinkRemove";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";

import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { getExcludedAnnotationIds } from "../utils/excludedAnnotationIds";
import { softGradientCardSx } from "Features/dashboard/utils/dashboardStyles";

// ---------------------------------------------------------------------------
// PopperLinkBusinessObjectHelper — floating helper shown while the
// business-object picking mode is armed (LINK: annotation clicks toggle a
// rel; EXCLUDE: they toggle an exclusion from the "Lien par modèle").
//
// Rendered by the helper chain of PopperMapListings IN PLACE of the listings
// panel — the PopperDrawingHelper pattern (same card, drag handle and exit
// cross), in the 2D editor and in the 3D editor of the business-objects
// modules alike. Self-guards on the linkingBusinessObjectId flag.
// ---------------------------------------------------------------------------

export default function PopperLinkBusinessObjectHelper() {
  const dispatch = useDispatch();

  // data

  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
  );
  const isExcludeMode = useSelector(
    (s) => s.businessObjects.linkingMode === "EXCLUDE"
  );
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );

  const businessObject = useLiveQuery(async () => {
    if (!linkingBusinessObjectId) return null;
    const o = await db.businessObjects.get(linkingBusinessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [linkingBusinessObjectId, businessObjectsUpdatedAt]);

  const { value: rels } = useRelsBusinessObjectAnnotation({
    businessObjectId: linkingBusinessObjectId,
  });

  // the object's listing type says whether the object carries a color
  // (listingsById = Dexie mirror kept by dexieSyncService)
  const listing = useSelector((s) =>
    businessObject?.listingId
      ? (s.listings.listingsById?.[businessObject.listingId] ?? null)
      : null
  );
  const hasColor = Boolean(
    getBusinessObjectTypeOfListing(listing).features?.color
  );

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // helpers

  const count = isExcludeMode
    ? getExcludedAnnotationIds(businessObject).length
    : (rels?.length ?? 0);
  const plural = count > 1 ? "s" : "";

  // strings

  const modeS = isExcludeMode ? "Exclusion" : "Liaison";
  const titleS = `${modeS} — ${businessObject?.label ?? ""}`;
  const instructionS = isExcludeMode
    ? "Cliquez sur une annotation d'un modèle lié pour l'exclure du calcul, un second clic la réintègre."
    : "Cliquez sur une annotation pour la lier à l'ouvrage, un second clic la délie.";
  const countS = isExcludeMode
    ? `${count} annotation${plural} exclue${plural}`
    : `${count} annotation${plural} liée${plural}`;
  const escapeS = isExcludeMode
    ? "Quitter le mode exclusion"
    : "Quitter le mode liaison";

  // handlers

  function handleExit() {
    dispatch(setLinkingBusinessObjectId(null));
  }

  // render

  if (!linkingBusinessObjectId || !businessObject) return null;

  const ModeIcon = isExcludeMode
    ? IconAnnotationLinkRemove
    : IconAnnotationLinkAdd;

  return (
    <Paper
      elevation={4}
      data-capture-hide
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
        <ModeIcon sx={{ fontSize: 16, color: "secondary.main" }} />
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, fontWeight: 500, color: "panel.textMuted" }}
        >
          {titleS}
        </Typography>
        <IconButton
          size="small"
          title={escapeS}
          aria-label={escapeS}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleExit}
          sx={(theme) => ({
            color: "secondary.main",
            bgcolor: alpha(theme.palette.secondary.main, 0.1),
            "&:hover": { bgcolor: alpha(theme.palette.secondary.main, 0.22) },
          })}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          px: 1.5,
          py: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {instructionS}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {hasColor && (
            <Box
              sx={{
                width: 10,
                height: 10,
                minWidth: 10,
                borderRadius: "2px",
                bgcolor: businessObject.color,
              }}
            />
          )}
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {countS}
          </Typography>
        </Box>

        <SectionShortcutHelpers shortcuts={[{ key: "Esc", label: escapeS }]} />
      </Box>
    </Paper>
  );
}
