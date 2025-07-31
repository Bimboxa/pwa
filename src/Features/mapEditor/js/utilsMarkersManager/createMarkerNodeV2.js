import theme from "Styles/theme";

import Konva from "konva";

import spriteImageUrl from "Features/markers/assets/spriteImage3x3.png";

// Load sprite image
let spriteImageElement = null;

// Function to load the sprite image
async function loadSpriteImage() {
  if (spriteImageElement) return spriteImageElement;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      console.log(
        "Sprite image loaded successfully:",
        img.width,
        "x",
        img.height
      );
      spriteImageElement = img;
      resolve(img);
    };
    img.onerror = (error) => {
      console.error("Failed to load sprite image:", error);
      reject(error);
    };
    img.src = spriteImageUrl;
  });
}

export default async function createMarkerNodeV2({
  x,
  y,
  iconColor,
  iconIndex,
}) {
  const bgcolor = iconColor ?? theme.palette.marker.default;

  // const

  const iconSize = 64; // 64
  const columns = 3;

  const row = Math.floor(iconIndex / columns);
  const col = iconIndex % columns;

  // Load sprite image
  const spriteImage = await loadSpriteImage();

  // Circle background - centered at (0,0) relative to group
  const circleNode = new Konva.Circle({
    radius: 16,
    fill: bgcolor,
    opacity: 0.8,
    x: 0, // Center of the group
    y: 0, // Center of the group
  });

  // Calculate scale to make icon 32x32 pixels globally
  const targetSize = 32;
  const scale = targetSize / iconSize; // 32 / 354 ≈ 0.09

  const icon = new Konva.Image({
    image: spriteImage,
    x: -(targetSize / 2), // Center the scaled icon horizontally
    y: -(targetSize / 2), // Center the scaled icon vertically
    width: iconSize,
    height: iconSize,
    scaleX: scale,
    scaleY: scale,
    crop: {
      x: col * iconSize,
      y: row * iconSize,
      width: iconSize,
      height: iconSize,
    },
  });

  icon.cache(); // Obligatoire pour les filtres
  //icon.filters([Konva.Filters.RGBA]);
  //icon.red(color.r);
  //icon.green(color.g);
  //icon.blue(color.b);
  //icon.alpha(1);

  const group = new Konva.Group({
    x, // Group position is the center point
    y, // Group position is the center point
    draggable: true,
  });

  // Add circle first (background), then debug rect, then icon (foreground)
  group.add(circleNode);
  group.add(icon);

  // Force the icon to be on top
  icon.moveToTop();

  return group;
}
