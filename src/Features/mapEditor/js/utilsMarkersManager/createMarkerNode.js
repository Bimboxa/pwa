import theme from "Styles/theme";

// Cache for converted SVG images
const svgImageCache = new Map();

// Helper function to convert SVG to image (cached)
async function svgToImage(svgString) {
  // Check cache first
  if (svgImageCache.has(svgString)) {
    return svgImageCache.get(svgString);
  }

  // Convert SVG to image
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      // Cache the converted image
      svgImageCache.set(svgString, img);
      resolve(img);
    };

    img.src = url;
  });
}

export default function createMarkerNode({
  marker,
  stageScale,
  imageNode,
  icon,
}) {
  // helper - id

  if ((!marker.id && !marker.isTemp) || !imageNode) return;
  const id = marker.id;

  // helper - color

  let color = marker.color ?? theme.palette.marker.default;

  // helper - points

  const imageSize = { width: imageNode.width(), height: imageNode.height() };
  const imagePosition = { x: imageNode.x(), y: imageNode.y() };

  const markerX = isNaN(marker.x) ? 0 : marker.x;
  const markerY = isNaN(marker.y) ? 0 : marker.y;

  const x = markerX * imageSize.width + imagePosition.x;
  const y = markerY * imageSize.height + imagePosition.y;

  // node

  const group = new Konva.Group({
    id,
    x,
    y,
    draggable: true,
  });

  // Circle background
  const circleNode = new Konva.Circle({
    radius: 16 / stageScale,
    fill: color,
    opacity: 0.8,
  });

  // SVG icon
  if (icon) {
    // Convert SVG to image if it's a string, otherwise use as-is
    const imagePromise =
      typeof icon === "string" ? svgToImage(icon) : Promise.resolve(icon);

    imagePromise.then((image) => {
      const iconNode = new Konva.Image({
        image: image,
        x: -8 / stageScale, // Center the icon (half of circle diameter)
        y: -8 / stageScale,
        width: 16 / stageScale,
        height: 16 / stageScale,
      });

      group.add(circleNode);
      group.add(iconNode);
      group.getLayer()?.batchDraw(); // Redraw to show the icon
    });
  } else {
    group.add(circleNode);
  }

  return group;
}
