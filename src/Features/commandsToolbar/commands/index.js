import { TOOLBAR_LAYOUTS } from "../constants/toolbarLayout";

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
import splitLineCommand from "./splitLine/splitLineCommand";
import splitPolylineClickCommand from "./splitPolylineClick/splitPolylineClickCommand";
import isolateSegmentCommand from "./isolateSegment/isolateSegmentCommand";
import surfaceCutCommand from "./surfaceCut/surfaceCutCommand";
import joinAnnotationsCommand from "./joinAnnotations/joinAnnotationsCommand";
import faceCutCommand from "./faceCut/faceCutCommand";
import isolateFaceCommand from "./isolateFace/isolateFaceCommand";
import mergeFacesCommand from "./mergeFaces/mergeFacesCommand";
import extrudeCommand from "./extrude/extrudeCommand";
import moveAnnotationCommand from "./moveAnnotation/moveAnnotationCommand";
import rotateAnnotationCommand from "./rotateAnnotation/rotateAnnotationCommand";
import wrapperModeCommand from "./wrapperMode/wrapperModeCommand";
import cloneCommand from "./clone/cloneCommand";
import mergeCommand from "./merge/mergeCommand";
import dilateCommand from "./dilate/dilateCommand";
import splitInSegmentsCommand from "./splitInSegments/splitInSegmentsCommand";
import settingOutCommand from "./settingOut/settingOutCommand";
import convertCommand from "./convert/convertCommand";
import reentrantAnglesCommand from "./reentrantAngles/reentrantAnglesCommand";
import cleanSegmentsCommand from "./cleanSegments/cleanSegmentsCommand";
import toggleStripTypeCommand from "./toggleStripType/toggleStripTypeCommand";
import toggleCloseLineCommand from "./toggleCloseLine/toggleCloseLineCommand";
import flipStripCommand from "./flipStrip/flipStripCommand";
import flipExtrusionCommand from "./flipExtrusion/flipExtrusionCommand";
import anchorCommand from "./anchor/anchorCommand";
import detectSimilarStripsCommand from "./detectSimilarStrips/detectSimilarStripsCommand";
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
import assignZoneCommand from "./assignZone/assignZoneCommand";
import assignBusinessObjectCommand from "./assignBusinessObject/assignBusinessObjectCommand";
import toggleSegmentCotesCommand from "./toggleSegmentCotes/toggleSegmentCotesCommand";
import toggleSegmentDragCommand from "./toggleSegmentDrag/toggleSegmentDragCommand";
import toggleAnglesLockedCommand from "./toggleAnglesLocked/toggleAnglesLockedCommand";
import moveBaseMapCommand from "./moveBaseMap/moveBaseMapCommand";
import rotateBaseMapCommand from "./rotateBaseMap/rotateBaseMapCommand";

// ---------------------------------------------------------------------------
// Registry of the commands of the unified toolbar — one folder per command
// under commands/<name>/:
//   <name>Command.js   { key, label, Icon, editors?, hotkey?, variants?,
//                        getActiveVariant?, getState(ctx), run?, Button? }
//   Button<Name>.jsx   only when the command owns a popup / needs hooks
// Contract:
// - getState(ctx) → { enabled, reason?, active? } is PURE (no hook): the
//   toolbar, the group menus and the hotkey listener share it;
// - a command with a `hotkey` has a pure `run(ctx, deps, variantKey?)` (the
//   listener calls it outside React); a popup-owning command exposes `Button`
//   ({ command, ctx, deps, state, hotkeyLabel }) and never returns null;
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
  splitLineCommand,
  splitPolylineClickCommand,
  isolateSegmentCommand,
  surfaceCutCommand,
  joinAnnotationsCommand,
  faceCutCommand,
  isolateFaceCommand,
  mergeFacesCommand,
  extrudeCommand,
  moveAnnotationCommand,
  rotateAnnotationCommand,
  // selection
  wrapperModeCommand,
  cloneCommand,
  mergeCommand,
  dilateCommand,
  splitInSegmentsCommand,
  settingOutCommand,
  convertCommand,
  reentrantAnglesCommand,
  cleanSegmentsCommand,
  toggleStripTypeCommand,
  toggleCloseLineCommand,
  flipStripCommand,
  flipExtrusionCommand,
  anchorCommand,
  detectSimilarStripsCommand,
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
  assignZoneCommand,
  assignBusinessObjectCommand,
  // 2D view toggles
  toggleSegmentCotesCommand,
  toggleSegmentDragCommand,
  toggleAnglesLockedCommand,
  // base map placement (3D)
  moveBaseMapCommand,
  rotateBaseMapCommand,
];

export const COMMANDS_BY_KEY = Object.fromEntries(
  COMMANDS.map((command) => [command.key, command])
);

// dev assertions — unique keys, hotkey ⇒ run, layout covers every command once
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
