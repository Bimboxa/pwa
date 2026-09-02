import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Paper, Box, Typography } from "@mui/material";
import { AddLink as LinkIcon } from "@mui/icons-material";

import db from "App/db/db";

import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";

// Floating helper shown while the business-object link mode is active
// (PopperSubtractHelper pattern): the armed object, an instruction, the live
// count of linked annotations, and the Escape shortcut to exit the mode.
// Mounted unconditionally in MainMapEditorV3 — self-guards on the flag.
export default function PopperLinkBusinessObjectHelper() {
  // data

  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
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

  // helpers

  const count = rels?.length ?? 0;

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
        <LinkIcon fontSize="small" />
        <Typography variant="subtitle2" noWrap>
          {`Mode liaison — ${businessObject.label}`}
        </Typography>
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Cliquez sur une annotation pour la lier à l&apos;ouvrage, un second
          clic la délie.
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              minWidth: 10,
              borderRadius: "2px",
              bgcolor: businessObject.color,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {`${count} annotation${count > 1 ? "s" : ""} liée${
              count > 1 ? "s" : ""
            }`}
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
            Quitter le mode liaison
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
