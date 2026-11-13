import { TOOLBAR_LAYOUTS } from "../constants/toolbarLayout";

import addCommentCommand from "./addComment/addCommentCommand";
import addLocatedCommentCommand from "./addLocatedComment/addLocatedCommentCommand";
import drawPolylineCommand from "./drawPolyline/drawPolylineCommand";
import drawPolygonCommand from "./drawPolygon/drawPolygonCommand";
import drawDiscCommand from "./drawDisc/drawDiscCommand";
import drawMarkerCommand from "./drawMarker/drawMarkerCommand";
import drawPointCommand from "./drawPoint/drawPointCommand";
import drawLabelCommand from "./drawLabel/drawLabelCommand";
import drawFreeTextCommand from "./drawFreeText/drawFreeTextCommand";
import drawDetailCommand from "./drawDetail/drawDetailCommand";
import drawImageCommand from "./drawImage/drawImageCommand";
import drawCoteCommand from "./drawCote/drawCoteCommand";
import drawRulerCommand from "./drawRuler/drawRulerCommand";
import cutCommand from "./cut/cutCommand";
import revolutionAxisCommand from "./revolutionAxis/revolutionAxisCommand";
import placeRevolutionAxisCommand from "./placeRevolutionAxis/placeRevolutionAxisCommand";
import splitLineCommand from "./splitLine/splitLineCommand";
import splitPolylineClickCommand from "./splitPolylineClick/splitPolylineClickCommand";
import isolateSegmentCommand from "./isolateSegment/isolateSegmentCommand";
import surfaceCutCommand from "./surfaceCut/surfaceCutCommand";
import joinAnnotationsCommand from "./joinAnnotations/joinAnnotationsCommand";
import faceCutCommand from "./faceCut/faceCutCommand";
import isolateFaceCommand from "./isolateFace/isolateFaceCommand";
import mergeFacesCommand from "./mergeFaces/mergeFacesCommand";
import extrudeCommand from "./extrude/extrudeCommand";
import extrudeAlongLineCommand from "./extrudeAlongLine/extrudeAlongLineCommand";
import moveAnnotationCommand from "./moveAnnotation/moveAnnotationCommand";
import rotateAnnotationCommand from "./rotateAnnotation/rotateAnnotationCommand";
import wrapperModeCommand from "./wrapperMode/wrapperModeCommand";
import changeStyleCommand from "./changeStyle/changeStyleCommand";
import hideAnnotationCommand from "./hideAnnotation/hideAnnotationCommand";
import cloneCommand from "./clone/cloneCommand";
import mergeCommand from "./merge/mergeCommand";
import addIntersectionPointsCommand from "./addIntersectionPoints/addIntersectionPointsCommand";
import dilateCommand from "./dilate/dilateCommand";
import splitInSegmentsCommand from "./splitInSegments/splitInSegmentsCommand";
import settingOutCommand from "./settingOut/settingOutCommand";
import convertCommand from "./convert/convertCommand";
import reentrantAnglesCommand from "./reentrantAngles/reentrantAnglesCommand";
import detectDuplicatesCommand from "./detectDuplicates/detectDuplicatesCommand";
import toggleStripTypeCommand from "./toggleStripType/toggleStripTypeCommand";
import toggleCloseLineCommand from "./toggleCloseLine/toggleCloseLineCommand";
import flipStripCommand from "./flipStrip/flipStripCommand";
import anchorCommand from "./anchor/anchorCommand";
import detectSimilarStripsCommand from "./detectSimilarStrips/detectSimilarStripsCommand";
import cleanCommand from "./clean/cleanCommand";
import repairCommand from "./repair/repairCommand";
import simplifyCommand from "./simplify/simplifyCommand";
import arcifyCommand from "./arcify/arcifyCommand";
import hollowOutCommand from "./hollowOut/hollowOutCommand";
import subtractCommand from "./subtract/subtractCommand";
import subtractFromCommand from "./subtractFrom/subtractFromCommand";
import addGuideLineCommand from "./addGuideLine/addGuideLineCommand";
import addSlopeCommand from "./addSlope/addSlopeCommand";
import autoSlopeCommand from "./autoSlope/autoSlopeCommand";
import addIsoHeightLineCommand from "./addIsoHeightLine/addIsoHeightLineCommand";
import addProfileLineCommand from "./addProfileLine/addProfileLineCommand";
import addLayoutLineCommand from "./addLayoutLine/addLayoutLineCommand";
import vectoriseCommand from "./vectorise/vectoriseCommand";
import contoursCommand from "./contours/contoursCommand";
import closeEnvelopeCommand from "./closeEnvelope/closeEnvelopeCommand";
import closeWallFootprintCommand from "./closeWallFootprint/closeWallFootprintCommand";
import autoWallsCommand from "./autoWalls/autoWallsCommand";
import slopeWallsCommand from "./slopeWalls/slopeWallsCommand";
import assignBusinessObjectCommand from "./assignBusinessObject/assignBusinessObjectCommand";
import toggleSegmentCotesCommand from "./toggleSegmentCotes/toggleSegmentCotesCommand";
import toggleSegmentDragCommand from "./toggleSegmentDrag/toggleSegmentDragCommand";
import toggleAnglesLockedCommand from "./toggleAnglesLocked/toggleAnglesLockedCommand";
import moveBaseMapCommand from "./moveBaseMap/moveBaseMapCommand";
import rotateBaseMapCommand from "./rotateBaseMap/rotateBaseMapCommand";
import placeAxesCommand from "./placeAxes/placeAxesCommand";
import toggleAxesCommand from "./toggleAxes/toggleAxesCommand";
import toggleGridCommand from "./toggleGrid/toggleGridCommand";
import resetAxesCommand from "./resetAxes/resetAxesCommand";
import drawCutLineCommand from "./drawCutLine/drawCutLineCommand";
import drawCutSegmentCommand from "./drawCutSegment/drawCutSegmentCommand";
import drawCutPlaneCommand from "./drawCutPlane/drawCutPlaneCommand";
import drawCutAngleCommand from "./drawCutAngle/drawCutAngleCommand";
import drawSectionLineCommand from "./drawSectionLine/drawSectionLineCommand";
import createSectionBaseMapCommand from "./createSectionBaseMap/createSectionBaseMapCommand";
import cutLinesPromptIaCommand from "./cutLinesPromptIa/cutLinesPromptIaCommand";
import addMeshCommand from "./addMesh/addMeshCommand";
import createMeshesCommand from "./createMeshes/createMeshesCommand";
import numberMeshesCommand from "./numberMeshes/numberMeshesCommand";

// ---------------------------------------------------------------------------
// Registry of the commands of the unified toolbar — one folder per command
// under commands/<name>/:
//   <name>Command.js   { key, usesSelection, label, Icon, editors?, hotkey?,
//                        variants?, getActiveVariant?, getState(ctx), run?,
//                        Button? }
//   Button<Name>.jsx   only when the command owns a popup / needs hooks
// Contract:
// - getState(ctx) → { enabled, reason?, active? } is PURE (no hook): the
//   toolbar, the group menus and the hotkey listener share it;
// - a command with a `hotkey` has a pure `run(ctx, deps, variantKey?)` (the
//   listener calls it outside React); a popup-owning command exposes `Button`
//   ({ command, ctx, deps, state, hotkeyLabel }) and never returns null;
// - `usesSelection` (boolean, REQUIRED, written in every command file — grep
//   `usesSelection:`): true when the command acts on the selected annotations
//   or reads them (pivot, seed, carried set…). With « Masquer les commandes
//   désactivées » on, the toolbar only shows these commands while at least
//   one annotation is selected (utils/isCommandShown);
// - registry order = hotkey resolution order (first enabled match wins).
// ---------------------------------------------------------------------------
export const COMMANDS = [
  // « Dessin » — one command per templateless annotation type (hotkey D on
  // the last-used one)
  drawPolylineCommand,
  drawPolygonCommand,
  drawDiscCommand,
  drawMarkerCommand,
  drawPointCommand,
  drawLabelCommand,
  drawFreeTextCommand,
  drawDetailCommand,
  drawImageCommand,
  drawCoteCommand,
  drawRulerCommand,
  cutCommand,
  revolutionAxisCommand,
  placeRevolutionAxisCommand,
  splitLineCommand,
  splitPolylineClickCommand,
  isolateSegmentCommand,
  surfaceCutCommand,
  joinAnnotationsCommand,
  faceCutCommand,
  isolateFaceCommand,
  mergeFacesCommand,
  extrudeCommand,
  extrudeAlongLineCommand,
  moveAnnotationCommand,
  rotateAnnotationCommand,
  // selection
  wrapperModeCommand,
  changeStyleCommand,
  cloneCommand,
  mergeCommand,
  addIntersectionPointsCommand,
  dilateCommand,
  splitInSegmentsCommand,
  settingOutCommand,
  convertCommand,
  reentrantAnglesCommand,
  detectDuplicatesCommand,
  toggleStripTypeCommand,
  toggleCloseLineCommand,
  flipStripCommand,
  anchorCommand,
  detectSimilarStripsCommand,
  cleanCommand,
  repairCommand,
  simplifyCommand,
  arcifyCommand,
  hollowOutCommand,
  subtractCommand,
  subtractFromCommand,
  addGuideLineCommand,
  addSlopeCommand,
  autoSlopeCommand,
  addIsoHeightLineCommand,
  addProfileLineCommand,
  addLayoutLineCommand,
  vectoriseCommand,
  contoursCommand,
  closeEnvelopeCommand,
  closeWallFootprintCommand,
  autoWallsCommand,
  slopeWallsCommand,
  assignBusinessObjectCommand,
  // view: session hide of annotations / mesh faces (2D + 3D)
  hideAnnotationCommand,
  // 2D view toggles
  toggleSegmentCotesCommand,
  toggleSegmentDragCommand,
  toggleAnglesLockedCommand,
  // base map placement (3D)
  moveBaseMapCommand,
  rotateBaseMapCommand,
  // user frame (3D)
  placeAxesCommand,
  toggleAxesCommand,
  toggleGridCommand,
  resetAxesCommand,
  // cut lines (3D, Maillage module)
  drawCutLineCommand,
  drawCutSegmentCommand,
  drawCutPlaneCommand,
  drawCutAngleCommand,
  cutLinesPromptIaCommand,
  drawSectionLineCommand,
  createSectionBaseMapCommand,
  // mailles (3D, Maillage module)
  addMeshCommand,
  createMeshesCommand,
  numberMeshesCommand,
  // comments (Commentaires module)
  addLocatedCommentCommand,
  addCommentCommand,
];

export const COMMANDS_BY_KEY = Object.fromEntries(
  COMMANDS.map((command) => [command.key, command])
);

// dev assertions — unique keys, hotkey ⇒ run, usesSelection tagged, layout
// covers every command once
if (import.meta.env.DEV) {
  const keys = COMMANDS.map((c) => c.key);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicates.length) {
    console.error("[commandsToolbar] duplicate command keys", duplicates);
  }
  COMMANDS.forEach((c) => {
    if (c.hotkey && typeof c.run !== "function") {
      console.error(
        `[commandsToolbar] ${c.key} declares a hotkey but no pure run()`
      );
    }
    if (typeof c.usesSelection !== "boolean") {
      console.error(
        `[commandsToolbar] ${c.key} has no usesSelection tag (true / false)`
      );
    }
    if (typeof c.getState !== "function") {
      console.error(`[commandsToolbar] ${c.key} has no getState()`);
    }
  });
  const everywhere = new Set();
  Object.entries(TOOLBAR_LAYOUTS).forEach(([name, layout]) => {
    const laidOut = [];
    layout.forEach((entry) => {
      if (typeof entry === "string") laidOut.push(entry);
      else if (entry?.type === "group") laidOut.push(...entry.commandKeys);
    });
    laidOut.forEach((k) => everywhere.add(k));
    const unknown = laidOut.filter((k) => !COMMANDS_BY_KEY[k]);
    const repeated = laidOut.filter((k, i) => laidOut.indexOf(k) !== i);
    if (unknown.length)
      console.error(
        `[commandsToolbar] layout ${name}: unknown commands`,
        unknown
      );
    if (repeated.length)
      console.error(
        `[commandsToolbar] layout ${name}: commands laid out twice`,
        repeated
      );
  });
  const missing = keys.filter((k) => !everywhere.has(k));
  if (missing.length)
    console.error(
      "[commandsToolbar] commands missing from every layout",
      missing
    );
}
