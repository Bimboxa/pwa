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
  const width = 260,
    padding = 12;
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
  // The photo touches the card edges. Padding belongs only to the caption.
  const height =
    imageHeight + (lines.length ? padding * 2 + lines.length * 18 : 0);
  canvas.width = width * 2;
  canvas.height = Math.ceil(height * 2);
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
  const physicalWidth = (bbox?.width > 0 ? bbox.width : width) * meterByPx;
  const physicalHeight = (physicalWidth * height) / width;
  const sprite = horizontal
    ? new Mesh(new PlaneGeometry(physicalWidth, physicalHeight), material)
    : new Sprite(material);
  if (horizontal)
    sprite.rotation.z = -((annotation.rotation || 0) * Math.PI) / 180;
  else sprite.scale.set(physicalWidth, physicalHeight, 1);
  sprite.renderOrder = 1003;
  let disposed = false;

  function draw(image) {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#171717";
    ctx.beginPath();
    ctx.roundRect(1, 1, width - 2, height - 2, 8);
    ctx.fill();
    if (image) {
      ctx.save();
      if (annotation.imageFlipY) {
        ctx.translate(0, imageHeight);
        ctx.scale(1, -1);
      }
      ctx.drawImage(image, 0, 0, width, imageHeight);
      ctx.restore();
    } else {
      ctx.fillStyle = "#333333";
      ctx.fillRect(0, 0, width, imageHeight);
      ctx.fillStyle = "#eeeeee";
      ctx.font = "13px sans-serif";
      ctx.fillText("Image", padding + 8, padding + 22);
    }
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillStyle = line.bold ? "#ffffff" : "#dddddd";
      ctx.font = `${line.bold ? "600 " : ""}13px sans-serif`;
      ctx.fillText(line.text, padding, padding + imageHeight + i * 18);
    });
    ctx.strokeStyle = selected ? "#ff9800" : "#555555";
    ctx.lineWidth = selected ? 3 : 1;
    ctx.stroke();
    if (veiled) {
      // Same rounded path is still the current one.
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fill();
    }
    if (badgeNumber != null) {
      const r = 11;
      const bx = width - r - 6;
      const by = r + 6;
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
