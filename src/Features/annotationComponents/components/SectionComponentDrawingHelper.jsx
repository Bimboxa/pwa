import { useDispatch, useSelector } from "react-redux";

import { patchNewAnnotation } from "Features/annotations/annotationsSlice";

import { Box, Typography } from "@mui/material";

import ListComponentItemsToggles from "./ListComponentItemsToggles";

import useComponentItems from "../hooks/useComponentItems";

// Drawing helper section of a « Composant » template being drawn: the
// templates the component generates, each one checked / unchecked for the
// next drawings. The choice rides the draft (`componentItemsEnabled`) and is
// stored on the drawn annotation at commit; the children are then generated
// by useComponentsSync. Renders nothing for any other template.
export default function SectionComponentDrawingHelper() {
  // strings

  const titleS = "Composant";

  // data

  const dispatch = useDispatch();
  const annotationTemplateId = useSelector(
    (s) => s.annotations.newAnnotation?.annotationTemplateId
  );
  const enabledMap = useSelector(
    (s) => s.annotations.newAnnotation?.componentItemsEnabled
  );
  const items = useComponentItems(annotationTemplateId, enabledMap);

  // handlers

  function handleToggle(templateId, enabled) {
    const next = {};
    for (const item of items) next[item.annotationTemplateId] = item.enabled;
    next[templateId] = enabled;
    dispatch(patchNewAnnotation({ componentItemsEnabled: next }));
  }

  // render

  if (!items.length) return null;

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 0.25 }}
      >
        {titleS}
      </Typography>
      <ListComponentItemsToggles items={items} onToggle={handleToggle} />
    </Box>
  );
}
