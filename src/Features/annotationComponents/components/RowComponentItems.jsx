import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { Box, Typography } from "@mui/material";

import ListComponentItemsToggles from "./ListComponentItemsToggles";

import db from "App/db/db";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import useComponentItems from "../hooks/useComponentItems";

// Row of ToolbarEditAnnotation shown for a « Composant » annotation: the
// templates it generates, each one enabled / disabled for THIS component
// (`annotation.componentItemsEnabled`). useComponentsSync then creates /
// removes the matching child annotation. Renders nothing for any other
// annotation.
export default function RowComponentItems({ annotation }) {
  // strings

  const titleS = "Composant";

  // data

  const dispatch = useDispatch();
  const annotationId = annotation?.id ?? null;
  const row = useLiveQuery(
    () => (annotationId ? db.annotations.get(annotationId) : null),
    [annotationId]
  );
  const items = useComponentItems(
    annotation?.annotationTemplateId,
    row?.componentItemsEnabled
  );
  const { isReadOnly } = useReadOnlyScope();

  // handlers

  async function handleToggle(templateId, enabled) {
    if (!annotationId) return;
    const next = {};
    for (const item of items) next[item.annotationTemplateId] = item.enabled;
    next[templateId] = enabled;
    await db.annotations.update(annotationId, { componentItemsEnabled: next });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  if (!items.length) return null;

  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontStyle: "italic", display: "block" }}
      >
        {titleS}
      </Typography>
      <ListComponentItemsToggles
        items={items}
        onToggle={handleToggle}
        disabled={isReadOnly}
      />
    </Box>
  );
}
