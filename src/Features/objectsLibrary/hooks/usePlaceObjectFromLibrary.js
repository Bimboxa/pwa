import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import {
  triggerAnnotationTemplatesUpdate,
  setNewAnnotation,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "Features/mapEditor/utils/startDrawFromTemplate";
import createObject3DEntityField from "Features/object3D/utils/createObject3DEntityField";

import buildAnnotationTemplateFromObject from "../utils/buildAnnotationTemplateFromObject";

function isObject3DEntry(object) {
  return object?.drawingShape === "OBJECT_3D" || Boolean(object?.file3d);
}

// Fetch the bundled glb URL and build the object3D entity field (reusing the
// same util as the "Nouveau modèle" form), keeping the raw File so createEntity
// stores it into db.files and rewrites object3D.fileName to the db.files key.
async function buildObject3DField(object) {
  if (!object?.file3dUrl) return null;
  const res = await fetch(object.file3dUrl);
  const blob = await res.blob();
  const file = new File([blob], object.file3d ?? "object.glb", {
    type: "model/gltf-binary",
  });
  return createObject3DEntityField(file);
}

// "Positionner"/"Localiser": create (or reuse) the configured annotationTemplate
// in the target listing, then arm the placement.
//   - 2D drawing figures: pre-create a template + launch the figure's drawing
//     tool (object.tool, e.g. POLYGON_CIRCLE_RADIUS), exactly like clicking the
//     template row in PopperMapListings.
//   - 3D objects: store the glb in db.files (via a template entity) + arm the
//     OBJECT_3D placement (ONE_CLICK) — 2D footprint or 3D controller.
// A given template is pre-created with our own id so the drawing commit reuses
// it instead of minting a duplicate.
export default function usePlaceObjectFromLibrary() {
  const dispatch = useDispatch();
  const createEntity = useCreateEntity();
  const selectedProjectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ object, userEdits, listingId, existingTemplate }) => {
    if (!object || !listingId) return;

    const projectId = selectedProjectId;

    // ---- OBJECT_3D placement ----
    // Arms the ONE_CLICK + OBJECT_3D state. It works in whichever editor is
    // displayed: in 2D the click is turned into a footprint rectangle
    // (getObject3DAnnotationRectanglePointsFromOnePoint) and committed as an
    // OBJECT_3D annotation; in 3D the object3DPlacementController handles it.
    if (isObject3DEntry(object)) {
      let template;
      if (existingTemplate) {
        // Already carries object3D with a valid db.files fileName.
        template = existingTemplate;
      } else {
        const object3DField = await buildObject3DField(object);
        if (!object3DField) {
          dispatch(
            setToaster({
              message: "Impossible de charger le fichier 3D.",
              severity: "error",
            })
          );
          return;
        }
        const draft = {
          id: nanoid(),
          modelIdMaster: object.modelIdMaster ?? null,
          drawingShape: "OBJECT_3D",
          object3D: object3DField,
          label: object.label ?? "",
        };
        // createEntity stores the glb into db.files AND rewrites
        // object3D.fileName to the db.files key; the returned entity carries the
        // rewritten field.
        const created = await createEntity(
          {
            ...draft,
            projectId,
            listingId,
            code: getAnnotationTemplateCode({
              annotation: draft,
              listingKey: listingId,
            }),
          },
          {
            listing: { id: listingId, projectId, table: "annotationTemplates" },
          }
        );
        dispatch(triggerAnnotationTemplatesUpdate());
        template = created ?? draft;
      }

      const baseProps = getNewAnnotationPropsFromAnnotationTemplate(template);
      dispatch(setSelectedListingId(listingId));
      dispatch(setNewAnnotation({ ...baseProps, type: "OBJECT_3D" }));
      dispatch(setEnabledDrawingMode("ONE_CLICK"));
      return;
    }

    // ---- 2D drawing figure ----
    let template;
    if (existingTemplate) {
      template = existingTemplate;
    } else {
      template = buildAnnotationTemplateFromObject(object, userEdits);
      if (!template) return;

      // Pre-create the template row (preserves template.id via createEntity's
      // `data?.id ?? nanoid()`), so useHandleCommitDrawing finds it on commit.
      await createEntity(
        {
          ...template,
          projectId,
          listingId,
          code: getAnnotationTemplateCode({
            annotation: template,
            listingKey: listingId,
          }),
        },
        { listing: { id: listingId, projectId, table: "annotationTemplates" } }
      );
      dispatch(triggerAnnotationTemplatesUpdate());
    }

    // Launch the figure's drawing tool (template.defaultTool = object.tool),
    // exactly like the template row in PopperMapListings: startDrawFromTemplate
    // sets the selected listing + newAnnotation draft + the enabled drawing mode.
    const activeTool = resolveActiveToolForTemplate(template, null);
    startDrawFromTemplate(dispatch, { template, listingId, activeTool });
  };
}
