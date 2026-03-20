import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

const DEFAULT_RED = { x: 0.1, y: 0.1 };
const DEFAULT_GREEN = { x: 0.9, y: 0.9 };

function CalibrationTarget({ cx, cy, color, containerK, targetColor }) {
  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      data-interaction="calibration-target"
      data-target-color={targetColor}
      style={{ cursor: "grab" }}
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

export default function CalibrationLayer({ containerK }) {
  // data

  const showCalibration = useSelector(
    (s) => s.baseMapEditor.showCalibration
  );
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );
  const hiddenVersionIds = useSelector(
    (s) => s.baseMapEditor.hiddenVersionIds
  );
  const baseMap = useMainBaseMap();

  // helpers

  if (!showCalibration || !baseMap) return null;

  const activeVersion = baseMap.getActiveVersion();
  if (!activeVersion) return null;

  // Hide targets if multiple versions are visible at the same time
  const allVersions = baseMap.versions || [];
  const visibleVersions = allVersions.filter(
    (v) => !hiddenVersionIds.includes(v.id)
  );
  if (visibleVersions.length > 1) return null;

  const imageSize = baseMap.getImageSize();
  if (!imageSize) return null;

  const { width, height } = imageSize;
  const versionId = activeVersion.id;

  const targets = calibrationTargetsByVersionId[versionId] || {
    red: DEFAULT_RED,
    green: DEFAULT_GREEN,
  };

  const redPos = {
    x: targets.red.x * width,
    y: targets.red.y * height,
  };
  const greenPos = {
    x: targets.green.x * width,
    y: targets.green.y * height,
  };

  // render

  return (
    <g style={{ pointerEvents: "auto" }}>
      <CalibrationTarget
        cx={redPos.x}
        cy={redPos.y}
        color="#e53935"
        containerK={containerK}
        targetColor="red"
      />
      <CalibrationTarget
        cx={greenPos.x}
        cy={greenPos.y}
        color="#43a047"
        containerK={containerK}
        targetColor="green"
      />
    </g>
  );
}
