import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Paper, Box, Typography } from "@mui/material";
import { AddLink as LinkIcon, LinkOff } from "@mui/icons-material";

import db from "App/db/db";

import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";

import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { getExcludedAnnotationIds } from "../utils/excludedAnnotationIds";

// Floating helper shown while the business-object link mode is active
// (PopperSubtractHelper pattern): the armed object, an instruction, the live
// count of linked (or excluded, in the EXCLUDE flavour) annotations, and the
// Escape shortcut to exit the mode.
// Mounted unconditionally in MainMapEditorV3 — self-guards on the flag.
export default function PopperLinkBusinessObjectHelper() {
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

  // helpers

  const count = isExcludeMode
    ? getExcludedAnnotationIds(businessObject).length
    : (rels?.length ?? 0);
  const plural = count > 1 ? "s" : "";

  // strings

  const titleS = isExcludeMode ? "Mode exclusion" : "Mode liaison";
  const instructionS = isExcludeMode
    ? "Cliquez sur une annotation d'un modèle lié pour l'exclure du calcul, un second clic la réintègre."
    : "Cliquez sur une annotation pour la lier à l'ouvrage, un second clic la délie.";
  const countS = isExcludeMode
    ? `${count} annotation${plural} exclue${plural}`
    : `${count} annotation${plural} liée${plural}`;
  const escapeS = isExcludeMode
    ? "Quitter le mode exclusion"
    : "Quitter le mode liaison";

  // render

  if (!linkingBusinessObjectId || !businessObject) return null;

  return (
    <Paper
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 50,
        left: 50,
        zIndex: 10,
        width: 290,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: "grey.900",
          color: "common.white",
          borderTopLeftRadius: (t) => t.shape.borderRadius,
          borderTopRightRadius: (t) => t.shape.borderRadius,
        }}
      >
        {isExcludeMode ? (
          <LinkOff fontSize="small" />
        ) : (
          <LinkIcon fontSize="small" />
        )}
        <Typography variant="subtitle2" noWrap>
          {`${titleS} — ${businessObject.label}`}
        </Typography>
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
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
          <Typography variant="caption" color="text.secondary">
            {countS}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              px: 0.75,
              py: 0.25,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 0.5,
              fontSize: "0.7rem",
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            Esc
          </Box>
          <Typography variant="caption" color="text.secondary">
            {escapeS}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
