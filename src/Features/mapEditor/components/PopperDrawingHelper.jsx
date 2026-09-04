import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, Paper, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import db from "App/db/db";

import SectionDrawingHelperContent from "./SectionDrawingHelperContent";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import useRelsBusinessObjectAnnotation from "Features/businessObjects/hooks/useRelsBusinessObjectAnnotation";
import selectLocatingBusinessObjectId from "Features/businessObjects/utils/selectLocatingBusinessObjectId";

// ---------------------------------------------------------------------------
// PopperDrawingHelper — floating panel shown while drawing
// ---------------------------------------------------------------------------

export default function PopperDrawingHelper() {
  // strings

  const drawS = "Mode dessin";

  // data — "Localiser" draw (Ouvrages module): the draft carries the
  // LOCATE_BUSINESS_OBJECT interceptor; the header names the object and a
  // warning tells when its main annotation on this base map gets replaced.

  const locatingBusinessObjectId = useSelector(selectLocatingBusinessObjectId);
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const locatingBusinessObject = useLiveQuery(async () => {
    if (!locatingBusinessObjectId) return null;
    const o = await db.businessObjects.get(locatingBusinessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [locatingBusinessObjectId, businessObjectsUpdatedAt]);
  const { value: locatingRels } = useRelsBusinessObjectAnnotation({
    businessObjectId: locatingBusinessObjectId,
  });
  const replacesMainOnBaseMap = (locatingRels ?? []).some(
    (r) => r.isMain && r.baseMapId === selectedBaseMapId
  );

  const titleS = locatingBusinessObject
    ? `Localiser — ${locatingBusinessObject.label}`
    : drawS;

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // render

  return (
    <Paper
      elevation={4}
      sx={{
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
      }}
    >
      {/* Drag handle header */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          bgcolor: "panel.headerBg",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: "panel.textLight" }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: "panel.textMuted" }}
        >
          {titleS}
        </Typography>
      </Box>

      {locatingBusinessObject && (
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
        </Box>
      )}

      <SectionDrawingHelperContent />
    </Paper>
  );
}
