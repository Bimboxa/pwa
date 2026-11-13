import {
  CanvasTexture,
  LinearFilter,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import { getImageAnnotationTextureAsync } from "Features/threedEditor/js/utilsAnnotationsManager/createImageAnnotation3D";

// One card contains the photo and its text, so picking and
// dragging the container never separates its title from its image.
// `badgeNumber`: display number of the photo (PopperImages tile), drawn in
// the top-right corner. `veiled`: another photo is selected → translucent
// white veil over the whole card (the 3D counterpart of the 2D veil; drawn
// in the canvas so VERTICAL sprites and HORIZONTAL planes look the same).
export default function createImageAnnotationCard(
  annotation,
  {
    selected,
    onLoaded,
    meterByPx = 0.01,
    badgeNumber = null,
    veiled = false,
  } = {}
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  // Floating paper: the photo (logical width 260) sits inside a white frame
  // (`frame`), itself surrounded by a transparent margin (`shadow`) that
  // holds the drop shadow. Canvas pixels only set texture resolution; the
  // PHOTO keeps the placed 2D size in metres, the frame and shadow add to it.
  const width = 260,
    padding = 12,
    frame = 10,
    shadow = 24,
    radius = 8;
  const inset = frame + shadow;
  const canvasWidth = width + 2 * inset;
  const size = annotation.image?.imageSize;
  const sourceAspect =
    size?.width > 0 && size?.height > 0 ? size.width / size.height : 1;
  // Match the placed 2D photo, including its aspect ratio after resizing.
  // Canvas pixels only set texture resolution; both card modes use metres.
  const bbox = annotation.bbox;
  const aspect =
    bbox?.width > 0 && bbox?.height > 0
      ? bbox.width / bbox.height
      : sourceAspect;
  const imageHeight = width / aspect;
  const title = annotation.label || annotation.annotationLabel || "";
  const description = annotation.labelDescription || "";
  const lines = [];
  function wrap(text, bold) {
    ctx.font = `${bold ? "600 " : ""}13px sans-serif`;
    for (const paragraph of text.split("\n")) {
      let line = "";
      // Character wrapping also handles long unbroken filenames / URLs.
      for (const character of paragraph) {
        if (
          line &&
          ctx.measureText(line + character).width > width - padding * 2
        ) {
          lines.push({ text: line, bold });
          line = "";
        }
        line += character;
      }
      lines.push({ text: line, bold });
    }
  }
  if (title) wrap(title, true);
  if (description) wrap(description, false);
  // Padding belongs only to the caption (under the photo, inside the frame).
  const cardHeight =
    imageHeight +
    2 * frame +
    (lines.length ? padding * 2 + lines.length * 18 : 0);
  const canvasHeight = cardHeight + 2 * shadow;
  canvas.width = canvasWidth * 2;
  canvas.height = Math.ceil(canvasHeight * 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  const horizontal = annotation.imageOrientation3d === "HORIZONTAL";
  const materialOptions = {
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    opacity: Number.isFinite(annotation.opacity) ? annotation.opacity : 1,
  };
  const material = horizontal
    ? new MeshBasicMaterial({ ...materialOptions, side: DoubleSide })
    : new SpriteMaterial({ ...materialOptions, sizeAttenuation: true });
  // The photo spans `width` logical px for `bbox.width` base-map px: the
  // whole canvas (frame + shadow included) scales by the same ratio.
  const physicalWidth =
    ((bbox?.width > 0 ? bbox.width : width) * meterByPx * canvasWidth) / width;
  const physicalHeight = (physicalWidth * canvasHeight) / canvasWidth;
  const sprite = horizontal
    ? new Mesh(new PlaneGeometry(physicalWidth, physicalHeight), material)
    : new Sprite(material);
  if (horizontal)
    sprite.rotation.z = -((annotation.rotation || 0) * Math.PI) / 180;
  else sprite.scale.set(physicalWidth, physicalHeight, 1);
  sprite.renderOrder = 1003;
  let disposed = false;

  function cardPath() {
    ctx.beginPath();
    ctx.roundRect(shadow, shadow, width + 2 * frame, cardHeight, radius);
  }

  function draw(image) {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // White paper with a soft drop shadow (elevation).
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff";
    cardPath();
    ctx.fill();
    ctx.restore();
    // Photo, inset in the frame, rounded corners.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(inset, inset, width, imageHeight, Math.max(0, radius - 3));
    ctx.clip();
    if (image) {
      if (annotation.imageFlipY) {
        ctx.translate(0, 2 * inset + imageHeight);
        ctx.scale(1, -1);
      }
      ctx.drawImage(image, inset, inset, width, imageHeight);
    } else {
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(inset, inset, width, imageHeight);
      ctx.fillStyle = "#555555";
      ctx.font = "13px sans-serif";
      ctx.fillText("Image", inset + padding + 8, inset + padding + 22);
    }
    ctx.restore();
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillStyle = line.bold ? "#222222" : "#555555";
      ctx.font = `${line.bold ? "600 " : ""}13px sans-serif`;
      ctx.fillText(
        line.text,
        inset + padding,
        inset + imageHeight + padding + i * 18
      );
    });
    cardPath();
    ctx.strokeStyle = selected ? "#ff9800" : "rgba(0,0,0,0.12)";
    ctx.lineWidth = selected ? 3 : 1;
    ctx.stroke();
    if (veiled) {
      // Same rounded path is still the current one.
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fill();
    }
    if (badgeNumber != null) {
      const r = 11;
      const bx = shadow + width + 2 * frame - r - 6;
      const by = shadow + r + 6;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = veiled ? "rgba(51,51,51,0.35)" : "#333333";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(badgeNumber), bx, by);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
    }
    texture.needsUpdate = true;
  }
  draw(null);
  sprite.userData = {
    annotationId: annotation.id,
    isImageAnnotationCard: true,
    imageOrientation3d: horizontal ? "HORIZONTAL" : "VERTICAL",
    noVertexSnap: true,
    dispose() {
      disposed = true;
      texture.dispose();
      material.dispose();
      if (horizontal) sprite.geometry.dispose();
    },
  };
  getImageAnnotationTextureAsync(annotation.image)
    .then((imageTexture) => {
      if (disposed || !imageTexture?.image) return;
      draw(imageTexture.image);
      onLoaded?.();
    })
    .catch((error) =>
      console.error("[imageAnnotations] card texture failed", error)
    );
  return sprite;
}
