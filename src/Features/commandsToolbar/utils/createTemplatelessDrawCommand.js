import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import TEMPLATELESS_DRAWING_SHAPES from "Features/annotations/constants/templatelessDrawingShapes.jsx";
import { DEFAULT_TEMPLATELESS_DRAWING_SHAPE } from "Features/annotations/utils/templatelessAnnotations";
import startTemplatelessDraw, {
  THREED_DRAWING_SHAPES,
} from "Features/mapEditor/utils/startTemplatelessDraw";

import { ALL_EDITORS, EDITOR_2D } from "../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
  getTemplatelessDrawGate,
} from "./drawToolCommandState";

// Shapes the "Dessin" commands offer in the displayed editor (3D: lines,
// surfaces and cotes only — face drawing).
export function getTemplatelessShapesForEditor(ctx) {
  return ctx.isThreedEditor
    ? TEMPLATELESS_DRAWING_SHAPES.filter((shape) =>
        THREED_DRAWING_SHAPES.includes(shape.key)
      )
    : TEMPLATELESS_DRAWING_SHAPES;
}

// Shape the « D » hotkey draws: the last-used one when the editor offers it,
// else the default (line), else the first offered.
export function getRememberedTemplatelessShapeKey(ctx) {
  const shapes = getTemplatelessShapesForEditor(ctx);
  const keys = shapes.map((s) => s.key);
  if (keys.includes(ctx.templatelessDrawingShape))
    return ctx.templatelessDrawingShape;
  if (keys.includes(DEFAULT_TEMPLATELESS_DRAWING_SHAPE))
    return DEFAULT_TEMPLATELESS_DRAWING_SHAPE;
  return keys[0] ?? null;
}

// One « Dessin » command per annotation type drawn WITHOUT template
// (templateless draft): Ligne, Surface, Disque, Repère, Point, Étiquette,
// Texte, Détail, Image, Cote, Règle — one button each in the toolbar. In the
// Dessin module the annotation has no listing either; in a business-objects
// module with an active object of a located listing (locate mode) it is
// written in that listing and LOCATES the object (ctx.locateBusinessObject).
// They share the « D » hotkey: only the remembered shape's command
// fires (the others yield) and carries the badge, so « D » keeps drawing the
// last-used type as before. `Icon` (a component) replaces the shape's icon
// element in the toolbar only (the shape pickers keep their own icon).
//
// `meshes`: the command is also offered in the Maillage module's 3D editor
// (the measures: cote, ruler — drawn over the mailles, snapping on the cut
// lines). Same guards as the « Ligne de coupe » command there (the module
// has no « Outils de dessin » gate nor interaction mode); a second click on
// the armed button disarms it, and the shape never becomes the remembered
// « D » shape of the Dessin module.
export default function createTemplatelessDrawCommand(
  shapeKey,
  { Icon, usesSelection, meshes = false } = {}
) {
  const shape = TEMPLATELESS_DRAWING_SHAPES.find((s) => s.key === shapeKey);
  if (!shape) throw new Error(`Unknown templateless shape ${shapeKey}`);
  const isRemembered = (ctx) =>
    getRememberedTemplatelessShapeKey(ctx) === shapeKey;
  // Maillage module (`meshes` commands only): 3D editor, no draw gate.
  const getMeshesState = (ctx) => {
    if (!ctx.isThreedEditor) {
      return { enabled: false, reason: "Disponible dans l'éditeur 3D" };
    }
    if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
    if (!ctx.selectedScopeId) {
      return { enabled: false, reason: "Sélectionnez un plan de repérage" };
    }
    if (ctx.enabledDrawingMode) {
      const active =
        ctx.isTemplatelessDraft && ctx.newAnnotationType === shapeKey;
      return active
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  };
  return {
    key: `DRAW_${shapeKey}`,
    usesSelection,
    label: `Dessiner — ${shape.label}`,
    Icon,
    icon: Icon ? undefined : shape.icon,
    editors: THREED_DRAWING_SHAPES.includes(shapeKey)
      ? ALL_EDITORS
      : [EDITOR_2D],
    hotkey: {
      key: "d",
      yieldWhen: (state, ctx) => !isRemembered(ctx),
      showBadgeWhen: isRemembered,
    },
    getState(ctx) {
      if (meshes && ctx.viewerKey === "MESHES") return getMeshesState(ctx);
      // Templateless annotations belong to a scope of the Dessin module, or
      // locate the active object of a located business-objects listing —
      // never to the ZONES flows.
      if (ctx.viewerKey !== "MAP" && !ctx.isLocateBusinessObjectMode) {
        return { enabled: false, reason: "Réservé au module Dessin" };
      }
      const gate = getTemplatelessDrawGate(ctx);
      if (gate) return gate;
      if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
      if (ctx.interactionMode !== "DRAW" && ctx.interactionMode != null) {
        return { enabled: false, reason: "Disponible en mode Dessin" };
      }
      if (!ctx.selectedScopeId) {
        return { enabled: false, reason: "Sélectionnez un plan de repérage" };
      }
      if (ctx.enabledDrawingMode) {
        const active =
          ctx.isTemplatelessDraft && ctx.templatelessDrawingShape === shapeKey;
        return active
          ? { enabled: true, active: true }
          : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
      }
      if (ctx.activeThreedTool) {
        return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
      }
      return { enabled: true };
    },
    run(ctx, { dispatch, store }) {
      if (meshes && ctx.viewerKey === "MESHES") {
        if (ctx.enabledDrawingMode) {
          // Armed: disarm (the Maillage module re-arms its meshing tools).
          dispatch(setEnabledDrawingMode(null));
          dispatch(setNewAnnotation({}));
          return;
        }
        startTemplatelessDraw(dispatch, store.getState(), shapeKey, {
          threed: true,
          remember: false,
        });
        return;
      }
      startTemplatelessDraw(dispatch, store.getState(), shapeKey, {
        threed: ctx.isThreedEditor,
        locate: ctx.locateBusinessObject,
      });
    },
  };
}
