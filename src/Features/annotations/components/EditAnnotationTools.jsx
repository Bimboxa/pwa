import IconButtonFlipStripAnnotation from "./IconButtonFlipStripAnnotation";
import IconButtonFlipExtrusionAnnotation from "./IconButtonFlipExtrusionAnnotation";
import IconButtonToggleStripType from "./IconButtonToggleStripType";
import IconButtonToggleAnnotationCloseLine from "./IconButtonToggleAnnotationCloseLine";
import IconButtonDetectSimilarStrips from "./IconButtonDetectSimilarStrips";
import IconButtonAnchorAnnotation from "./IconButtonAnchorAnnotation";
import IconButtonSubtractAnnotation from "./IconButtonSubtractAnnotation";
import IconButtonSubtractFromAnnotation from "./IconButtonSubtractFromAnnotation";
import IconButtonHollowOutAnnotation from "./IconButtonHollowOutAnnotation";
import IconButtonAssignZoneAnnotations from "Features/zonings/components/IconButtonAssignZoneAnnotations";
import IconButtonAssignBusinessObjectAnnotations from "Features/businessObjects/components/IconButtonAssignBusinessObjectAnnotations";
import IconButtonDilateAnnotation from "./IconButtonDilateAnnotation";
import IconButtonRepairAnnotation from "./IconButtonRepairAnnotation";
import IconButtonSplitInSegments from "./IconButtonSplitInSegments";
import IconButtonSettingOut from "./IconButtonSettingOut";
import IconButtonConvertAnnotation from "./IconButtonConvertAnnotation";
import IconButtonVectorisation from "./IconButtonVectorisation";
import IconButtonSimplifyAnnotation from "./IconButtonSimplifyAnnotation";
import IconButtonArcifyAnnotation from "./IconButtonArcifyAnnotation";
import IconButtonCloseWallFootprint from "./IconButtonCloseWallFootprint";
import IconButtonSlopeWalls from "./IconButtonSlopeWalls";
import IconButtonAutoWalls from "./IconButtonAutoWalls";
import IconButtonContours from "./IconButtonContours";
import IconButtonCloseEnvelope from "./IconButtonCloseEnvelope";
import IconButtonAddGuideLine from "./IconButtonAddGuideLine";
import IconButtonAddSlope from "./IconButtonAddSlope";
import IconButtonAddIsoHeightLine from "./IconButtonAddIsoHeightLine";
import IconButtonAddProfileLine from "./IconButtonAddProfileLine";
import IconButtonAutoSlope from "./IconButtonAutoSlope";

// Edit tools of a single annotation. Rendered inside
// IconButtonMoreAnnotationTools ("Plus d'outils" of the quick-action row above
// the annotation), where ToolbarToolsContext turns every tool into a MenuItem
// (icon + label), and inline in the ToolbarEditAnnotation actions row as a
// fallback when the annotation has no such row (see
// getAnnotationHasOverlayActions, 3D editor).
// Keep the order here: it is both the row order and the menu order.
export default function EditAnnotationTools({
  selectedAnnotation,
  accentColor,
  isClosedShape,
}) {
  // isMesh3d: the 2D polygon is the plan projection of a stored 3D mesh —
  // every tool below edits the 2D geometry, which would break that link.
  if (selectedAnnotation?.isMesh3d) return null;

  return (
    <>
      {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) && (
        <IconButtonAnchorAnnotation
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) &&
        !selectedAnnotation?.closeLine && (
          <IconButtonToggleStripType
            annotation={selectedAnnotation}
            accentColor={accentColor}
          />
        )}
      {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) && (
        <IconButtonToggleAnnotationCloseLine
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {["STRIP", "LINEAR_LAYOUT"].includes(selectedAnnotation?.type) && (
        <IconButtonFlipStripAnnotation
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.shape3D?.key === "EXTRUSION_PROFILE" && (
        <IconButtonFlipExtrusionAnnotation
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.type === "STRIP" && (
        <IconButtonDetectSimilarStrips
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {isClosedShape && (
        <IconButtonDilateAnnotation
          annotations={[selectedAnnotation]}
          accentColor={accentColor}
        />
      )}
      {["POLYLINE", "POLYGON", "STRIP"].includes(selectedAnnotation?.type) && (
        <IconButtonRepairAnnotation
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {["POLYLINE", "POLYGON", "STRIP"].includes(selectedAnnotation?.type) && (
        <IconButtonSplitInSegments
          annotations={[selectedAnnotation]}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.type === "POLYLINE" && (
        <IconButtonSettingOut
          annotations={[selectedAnnotation]}
          accentColor={accentColor}
        />
      )}
      {["POLYGON", "RECTANGLE", "POLYLINE", "STRIP"].includes(
        selectedAnnotation?.type
      ) && (
        <>
          <IconButtonSubtractAnnotation
            annotation={selectedAnnotation}
            accentColor={accentColor}
          />
          <IconButtonSubtractFromAnnotation
            annotation={selectedAnnotation}
            accentColor={accentColor}
          />
        </>
      )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonHollowOutAnnotation
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.isZoneAnnotation &&
        selectedAnnotation?.type === "POLYGON" && (
          <IconButtonAssignZoneAnnotations
            annotation={selectedAnnotation}
            accentColor={accentColor}
          />
        )}
      {selectedAnnotation?.canAssignMainBusinessObject &&
        selectedAnnotation?.type === "POLYGON" && (
          <IconButtonAssignBusinessObjectAnnotations
            annotation={selectedAnnotation}
            accentColor={accentColor}
          />
        )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonConvertAnnotation
          annotations={[selectedAnnotation]}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonVectorisation
          annotations={[selectedAnnotation]}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonCloseWallFootprint
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonAddGuideLine accentColor={accentColor} />
      )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonAddSlope accentColor={accentColor} />
      )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonAddIsoHeightLine accentColor={accentColor} />
      )}
      {["POLYGON", "POLYLINE"].includes(selectedAnnotation?.type) && (
        <IconButtonAddProfileLine accentColor={accentColor} />
      )}
      {selectedAnnotation?.type === "POLYGON" && (
        <IconButtonAutoSlope accentColor={accentColor} />
      )}
      {selectedAnnotation?.type === "POLYGON" &&
        selectedAnnotation?.guideLines?.some(
          (g) => g?.points?.length >= 2 && g?.slopePct
        ) && (
          <IconButtonSlopeWalls
            annotation={selectedAnnotation}
            accentColor={accentColor}
          />
        )}
      {["POLYGON", "POLYLINE"].includes(selectedAnnotation?.type) && (
        <IconButtonAutoWalls accentColor={accentColor} />
      )}
      {["POLYLINE", "POLYGON", "STRIP"].includes(selectedAnnotation?.type) && (
        <IconButtonSimplifyAnnotation
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {selectedAnnotation?.type === "POLYLINE" && (
        <IconButtonArcifyAnnotation
          annotation={selectedAnnotation}
          accentColor={accentColor}
        />
      )}
      {["POLYLINE", "STRIP", "POLYGON"].includes(selectedAnnotation?.type) && (
        <IconButtonContours
          annotations={[selectedAnnotation]}
          accentColor={accentColor}
        />
      )}
      {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) && (
        <IconButtonCloseEnvelope
          annotations={[selectedAnnotation]}
          accentColor={accentColor}
        />
      )}
    </>
  );
}
