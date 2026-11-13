import ImageIndexBadgeSvg from "Features/popperImages/components/ImageIndexBadgeSvg";

// Paper-style photo tile of a capture (white card, shadow, rounded), drawn
// in the ImageModeOverlay svg: the photo (cover), its label as a caption and
// the optional display number badge. `tile` = { x, y, width, height, number }
// in the px of the parent group. Shared by the "overlay" zone
// (CaptureImagesOverlay) and the print zones (CaptureImagePrintZonesOverlay).

const TILE_PADDING = 4;
export const CAPTURE_TILE_CAPTION_HEIGHT = 16;

export default function CaptureImageTileCard({ tile, annotation, showNumber }) {
  // data

  const src = annotation?.image?.imageUrlClient ?? annotation?.image?.thumbnail;

  // render

  return (
    <g transform={`translate(${tile.x}, ${tile.y})`}>
      <foreignObject
        width={tile.width}
        height={tile.height}
        style={{ overflow: "visible" }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            width: tile.width,
            height: tile.height,
            boxSizing: "border-box",
            background: "#fff",
            borderRadius: 8,
            padding: TILE_PADDING,
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {src && (
            <img
              src={src}
              alt=""
              style={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                objectFit: "cover",
                borderRadius: 5,
                display: "block",
                transform: annotation?.imageFlipY ? "scaleY(-1)" : undefined,
              }}
            />
          )}
          {annotation?.label && (
            <div
              style={{
                font: "600 11px sans-serif",
                lineHeight: `${CAPTURE_TILE_CAPTION_HEIGHT - 2}px`,
                height: CAPTURE_TILE_CAPTION_HEIGHT - 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "#222",
              }}
            >
              {annotation.label}
            </div>
          )}
        </div>
      </foreignObject>
      {showNumber && (
        <g transform="translate(2, 2)">
          <ImageIndexBadgeSvg number={tile.number} />
        </g>
      )}
    </g>
  );
}
