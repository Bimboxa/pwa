import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";

const HANDLE_SIZE_PX = 4;

export default function EditedVersionLayer({
  basePose,
  versionTransform,
  versionImageUrl,
  versionImageSize,
  versionId,
  baseMapId,
}) {
  if (!versionImageUrl || !versionImageSize) return null;

  const { width, height } = versionImageSize;
  const t = versionTransform || { x: 0, y: 0, rotation: 0, scale: 1 };

  // Serialized data for InteractionLayer to parse on mousedown
  const transformJson = JSON.stringify(t);
  const imageSizeJson = JSON.stringify({ width, height });

  const Handle = ({ x, y, cursor, type }) => (
    <g transform={`translate(${x}, ${y})`}>
      <g
        style={{
          transform: `scale(calc(1 / (var(--map-zoom, 1) * ${basePose.k} * ${t.scale || 1})))`,
        }}
      >
        <rect
          x={-HANDLE_SIZE_PX / 2}
          y={-HANDLE_SIZE_PX / 2}
          width={HANDLE_SIZE_PX}
          height={HANDLE_SIZE_PX}
          fill="white"
          stroke="#2196f3"
          strokeWidth={1}
          style={{ cursor, pointerEvents: "auto" }}
          data-interaction="transform-version"
          data-handle-type={type}
          data-version-id={versionId}
          data-base-map-id={baseMapId}
          data-version-transform={transformJson}
          data-version-image-size={imageSizeJson}
        />
      </g>
    </g>
  );

  return (
    <g
      transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
    >
      <g
        transform={`translate(${t.x}, ${t.y}) scale(${t.scale || 1}) rotate(${t.rotation || 0})`}
      >
        <NodeSvgImage
          src={versionImageUrl}
          width={width}
          height={height}
          opacity={0.8}
          style={{ pointerEvents: "none" }}
        />

        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          stroke="#2196f3"
          vectorEffect="non-scaling-stroke"
          strokeWidth={1}
          style={{ cursor: "move", pointerEvents: "auto" }}
          data-interaction="transform-version"
          data-handle-type="MOVE"
          data-version-id={versionId}
          data-base-map-id={baseMapId}
          data-version-transform={transformJson}
          data-version-image-size={imageSizeJson}
        />

        <Handle x={0} y={0} cursor="nw-resize" type="NW" />
        <Handle x={width} y={0} cursor="ne-resize" type="NE" />
        <Handle x={width} y={height} cursor="se-resize" type="SE" />
        <Handle x={0} y={height} cursor="sw-resize" type="SW" />
      </g>
    </g>
  );
}
