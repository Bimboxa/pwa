import { useDispatch, useSelector, useStore } from "react-redux";

import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";
import { toggleAnnotationTemplateHidden } from "Features/scopeVisibility/scopeVisibilitySlice";

import { selectHiddenAnnotationTemplateIds } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";

import startTemplatelessDraw from "Features/mapEditor/utils/startTemplatelessDraw";
import {
  DEFAULT_TEMPLATELESS_DRAWING_SHAPE,
  TEMPLATELESS_TEMPLATE_ID,
} from "Features/annotations/utils/templatelessAnnotations";
import TEMPLATELESS_DRAWING_SHAPES from "Features/annotations/constants/templatelessDrawingShapes.jsx";

// ---------------------------------------------------------------------------
// useDrawTemplateless — "Dessin" tool row (hotkey D): annotation type
// resolution + activation dispatches + solo / eye of the templateless
// annotations. Shared by PopperMapListings and the Dessin left panel.
// ---------------------------------------------------------------------------

export default function useDrawTemplateless() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const drawingShape = useSelector((s) => s.mapEditor.templatelessDrawingShape);
  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );
  const hiddenIds = useSelector(selectHiddenAnnotationTemplateIds);

  // helpers

  const shapes = TEMPLATELESS_DRAWING_SHAPES;
  const activeShape =
    shapes.find((shape) => shape.key === drawingShape) ??
    shapes.find((shape) => shape.key === DEFAULT_TEMPLATELESS_DRAWING_SHAPE);

  const isSolo = soloTemplateId === TEMPLATELESS_TEMPLATE_ID;
  const isHidden = hiddenIds.includes(TEMPLATELESS_TEMPLATE_ID);

  // handlers

  const startDraw = () => {
    startTemplatelessDraw(dispatch, store.getState(), activeShape?.key);
  };

  const selectShapeAndDraw = (shape) => {
    startTemplatelessDraw(dispatch, store.getState(), shape.key);
  };

  const toggleSolo = () => {
    dispatch(
      setSoloAnnotationTemplateId(isSolo ? null : TEMPLATELESS_TEMPLATE_ID)
    );
  };

  const toggleHidden = () => {
    dispatch(toggleAnnotationTemplateHidden(TEMPLATELESS_TEMPLATE_ID));
  };

  return {
    shapes,
    activeShape,
    startDraw,
    selectShapeAndDraw,
    isSolo,
    isHidden,
    toggleSolo,
    toggleHidden,
  };
}
