import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { DEFAULT_RED, DEFAULT_GREEN } from "Features/mapEditor/utils/computeCalibrationTransform";

const CALIBRATION_CLIP_ACTIVE_ID = "calibration-clip-active";
const CALIBRATION_CLIP_REF_ID = "calibration-clip-ref";

export { CALIBRATION_CLIP_ACTIVE_ID, CALIBRATION_CLIP_REF_ID };

function CalibrationTarget({ cx, cy, color, containerK, targetColor, versionId, opacity = 1 }) {
  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      data-interaction="calibration-target"
      data-target-color={targetColor}
      data-version-id={versionId}
      style={{ cursor: "grab", opacity }}
    >
      <g style={{
        transform: `scale(calc(1 / (var(--map-zoom, 1) * ${containerK})))`,
        transformOrigin: "0 0",
      }}>
        {/* Outer colored circle */}
        <circle r="18" fill="rgba(0,0,0,0.08)" stroke={color} strokeWidth="2.5" />
        {/* Inner ring */}
        <circle r="10" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
        {/* White crosshair */}
        <line x1="-14" y1="0" x2="-4" y2="0" stroke="white" strokeWidth="2" />
        <line x1="4" y1="0" x2="14" y2="0" stroke="white" strokeWidth="2" />
        <line x1="0" y1="-14" x2="0" y2="-4" stroke="white" strokeWidth="2" />
        <line x1="0" y1="4" x2="0" y2="14" stroke="white" strokeWidth="2" />
        {/* Center dot */}
        <circle r="2.5" fill={color} />
      </g>
    </g>
  );
}

function TargetPair({ targets, width, height, containerK, versionId, opacity }) {
  const redPos = { x: targets.red.x * width, y: targets.red.y * height };
  const greenPos = { x: targets.green.x * width, y: targets.green.y * height };

  return (
    <>
      <CalibrationTarget
        cx={redPos.x}
        cy={redPos.y}
        color="#e53935"
        containerK={containerK}
        targetColor="red"
        versionId={versionId}
        opacity={opacity}
      />
      <CalibrationTarget
        cx={greenPos.x}
        cy={greenPos.y}
        color="#43a047"
        containerK={containerK}
        targetColor="green"
        versionId={versionId}
        opacity={opacity}
      />
    </>
  );
}

export default function CalibrationLayer({ containerK }) {
  // data

  const showCalibration = useSelector(
    (s) => s.baseMapEditor.showCalibration
  );
  const isCalibrating = useSelector(
    (s) => s.baseMapEditor.isCalibrating
  );
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );
  const hiddenVersionIds = useSelector(
    (s) => s.baseMapEditor.hiddenVersionIds
  );
  const versionCompareEnabled = useSelector(
    (s) => s.baseMapEditor.versionCompareEnabled
  );
  const versionCompareId = useSelector(
    (s) => s.baseMapEditor.versionCompareId
  );
  const baseMap = useMainBaseMap();

  // helpers

  if (!showCalibration || !baseMap) return null;

  const activeVersion = baseMap.getActiveVersion();
  if (!activeVersion) return null;

  const imageSize = baseMap.getImageSize();
  if (!imageSize) return null;

  const { width, height } = imageSize;
  const isCompareCalibration = isCalibrating && versionCompareEnabled && versionCompareId;

  // Compare calibration mode: show targets for both versions with clip paths
  if (isCompareCalibration) {
    const activeTargets = calibrationTargetsByVersionId[activeVersion.id] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };
    const refTargets = calibrationTargetsByVersionId[versionCompareId] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };

    return (
      <g style={{ pointerEvents: "auto" }}>
        {/* Clip path definitions — rects updated by CompareVersionSlider */}
        <defs>
          <clipPath id={CALIBRATION_CLIP_ACTIVE_ID}>
            <rect id={`${CALIBRATION_CLIP_ACTIVE_ID}-rect`} x={0} y={0} width={0} height={0} />
          </clipPath>
          <clipPath id={CALIBRATION_CLIP_REF_ID}>
            <rect id={`${CALIBRATION_CLIP_REF_ID}-rect`} x={0} y={0} width={0} height={0} />
          </clipPath>
        </defs>

        {/* Reference version targets — right of slider, 0.8 opacity */}
        <g clipPath={`url(#${CALIBRATION_CLIP_REF_ID})`}>
          <TargetPair
            targets={refTargets}
            width={width}
            height={height}
            containerK={containerK}
            versionId={versionCompareId}
            opacity={0.8}
          />
        </g>

        {/* Active version targets — left of slider, full opacity */}
        <g clipPath={`url(#${CALIBRATION_CLIP_ACTIVE_ID})`}>
          <TargetPair
            targets={activeTargets}
            width={width}
            height={height}
            containerK={containerK}
            versionId={activeVersion.id}
            opacity={1}
          />
        </g>
      </g>
    );
  }

  // Standard calibration mode (no compare): single set of targets
  const allVersions = baseMap.versions || [];
  const visibleVersions = allVersions.filter(
    (v) => !hiddenVersionIds.includes(v.id)
  );
  if (visibleVersions.length > 1) return null;

  const targets = calibrationTargetsByVersionId[activeVersion.id] || {
    red: DEFAULT_RED,
    green: DEFAULT_GREEN,
  };

  return (
    <g style={{ pointerEvents: "auto" }}>
      <TargetPair
        targets={targets}
        width={width}
        height={height}
        containerK={containerK}
        versionId={activeVersion.id}
        opacity={1}
      />
    </g>
  );
}
