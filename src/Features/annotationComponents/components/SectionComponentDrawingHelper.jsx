import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { patchNewAnnotation } from "Features/annotations/annotationsSlice";

import { Box, Typography } from "@mui/material";

import ListComponentItemsToggles from "./ListComponentItemsToggles";
import SvgComponentPreview from "./SvgComponentPreview";

import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import useComponentItems from "../hooks/useComponentItems";

// Drawing helper section of a « Composant » template being drawn: the
// templates the component generates, each one checked / unchecked for the
// next drawings. The choice rides the draft (`componentItemsEnabled`) and is
// stored on the drawn annotation at commit; the children are then generated
// by useComponentsSync. On the right half, a schematic preview: the source
// annotation, then the annotations the checked templates generate (see
// SvgComponentPreview). Renders nothing for any other template.
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

  // data - preview: the draft (source annotation), its template, the base map

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const componentTemplate = useLiveQuery(
    () =>
      annotationTemplateId
        ? db.annotationTemplates.get(annotationTemplateId)
        : null,
    [annotationTemplateId]
  );
  const baseMap = useMainBaseMap();

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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ListComponentItemsToggles items={items} onToggle={handleToggle} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SvgComponentPreview
            source={newAnnotation}
            componentTemplate={componentTemplate}
            items={items}
            baseMap={baseMap}
          />
        </Box>
      </Box>
    </Box>
  );
}
