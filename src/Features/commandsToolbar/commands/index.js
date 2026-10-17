import TOOLBAR_LAYOUT from "../constants/toolbarLayout";

import drawCommand from "./draw/drawCommand";
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
import curvatureCommand from "./curvature/curvatureCommand";
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
  drawCommand,
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
  curvatureCommand,
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
  const laidOut = [];
  TOOLBAR_LAYOUT.forEach((entry) => {
    if (typeof entry === "string") laidOut.push(entry);
    else if (entry?.type === "group") laidOut.push(...entry.commandKeys);
  });
  const unknown = laidOut.filter((k) => !COMMANDS_BY_KEY[k]);
  const missing = keys.filter((k) => !laidOut.includes(k));
  const repeated = laidOut.filter((k, i) => laidOut.indexOf(k) !== i);
  if (unknown.length)
    console.error("[commandsToolbar] layout names unknown commands", unknown);
  if (missing.length)
    console.error(
      "[commandsToolbar] commands missing from the layout",
      missing
    );
  if (repeated.length)
    console.error("[commandsToolbar] commands laid out twice", repeated);
}
