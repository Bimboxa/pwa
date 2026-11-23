import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { Box, Button, Typography } from "@mui/material";
import { CallSplit } from "@mui/icons-material";

import ListComponentItemsToggles from "./ListComponentItemsToggles";

import db from "App/db/db";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import useComponentItems from "../hooks/useComponentItems";
import useExplodeComponents from "../hooks/useExplodeComponents";

// Row of ToolbarEditAnnotation shown for a « Composant » annotation: the
// templates it generates, each one enabled / disabled for THIS component
// (`annotation.componentItemsEnabled`). useComponentsSync then creates /
// removes the matching child annotation. « Éclater », right of the title,
// frees the generated annotations and deletes the component
// (useExplodeComponents — the selection ends up empty). Renders nothing for
// any other annotation.
export default function RowComponentItems({ annotation }) {
  // strings

  const titleS = "Composant";
  const explodeS = "Éclater";
  const explodeTitleS =
    "Remplace le composant par ses annotations, rendues indépendantes";
  const noItemS = "Le composant n'a aucun élément actif";

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
  const explodeComponents = useExplodeComponents();

  // helpers

  // nothing to free until the sync has generated an annotation
  const canExplode = (row?.componentApplied?.count ?? 0) > 0;

  // handlers

  async function handleToggle(templateId, enabled) {
    if (!annotationId) return;
    const next = {};
    for (const item of items) next[item.annotationTemplateId] = item.enabled;
    next[templateId] = enabled;
    await db.annotations.update(annotationId, { componentItemsEnabled: next });
    dispatch(triggerAnnotationsUpdate());
  }

  async function handleExplode() {
    if (!annotationId) return;
    try {
      await explodeComponents([annotationId]);
    } catch (e) {
      console.error("[explodeComponent]", e);
    }
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontStyle: "italic" }}
        >
          {titleS}
        </Typography>
        {!isReadOnly && (
          // span: keeps the tooltip on the disabled button
          <Box component="span" title={canExplode ? explodeTitleS : noItemS}>
            <Button
              size="small"
              color="inherit"
              startIcon={<CallSplit sx={{ fontSize: 14 }} />}
              disabled={!canExplode}
              onClick={handleExplode}
              sx={{
                py: 0,
                minHeight: 0,
                fontSize: 12,
                textTransform: "none",
                color: "text.secondary",
              }}
            >
              {explodeS}
            </Button>
          </Box>
        )}
      </Box>
      <ListComponentItemsToggles
        items={items}
        onToggle={handleToggle}
        disabled={isReadOnly}
      />
    </Box>
  );
}
