import { useDispatch } from "react-redux";

import {
  setSelectedMainBaseMapId,
  setSelectedNode,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";

import { Button, Tooltip } from "@mui/material";
import { OpenInNew as OpenIcon } from "@mui/icons-material";

/**
 * A footprint is only a projection: the real annotation lives on another base
 * map. This switches the editor to that base map and selects it there.
 */
export default function IconButtonGoToForeignAnnotation({ annotation }) {
  const dispatch = useDispatch();

  // handlers

  function handleClick() {
    const targetId = annotation?.foreignAnnotationId;
    const targetBaseMapId = annotation?.foreignBaseMapId;
    if (!targetId || !targetBaseMapId) return;

    // The 2D editor displays s.mapEditor.selectedBaseMapId (baseMapsSlice's
    // setSelectedBaseMapId drives a different slice — see useMainBaseMap).
    dispatch(setSelectedMainBaseMapId(targetBaseMapId));

    const item = {
      id: targetId,
      nodeId: targetId,
      type: "NODE",
      nodeType: "ANNOTATION",
      annotationType: annotation?.type,
      listingId: annotation?.listingId,
      annotationTemplateId: annotation?.annotationTemplateId,
    };
    dispatch(setSelectedNode({ ...item }));
    dispatch(setSelectedItem(item));
    dispatch(setShowAnnotationsProperties(true));
  }

  // render

  return (
    <Tooltip title="Ouvrir le fond de plan de l'annotation d'origine">
      <Button
        size="small"
        startIcon={<OpenIcon fontSize="small" />}
        onClick={handleClick}
        sx={{ textTransform: "none", whiteSpace: "nowrap" }}
      >
        Voir l&apos;annotation d&apos;origine
      </Button>
    </Tooltip>
  );
}
