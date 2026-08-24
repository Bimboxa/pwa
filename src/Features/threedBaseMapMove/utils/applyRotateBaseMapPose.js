// Poses the rotated base map group for a given angle phi (rad) around the
// world-vertical axis through the grab pivot: with the group's YXZ euler,
// adding to rotation.y IS a world-Y rotation — whatever the plane
// orientation — and the position orbits the pivot in the horizontal plane.
// Shared by the overlay (mouse-driven) and the keyboard angle buffer.
export default function applyRotateBaseMapPose(editor, grab, phi) {
  const group = editor?.sceneManager?.imagesManager?.getGroup(grab.baseMapId);
  if (!group) return;
  grab.currentPhi = phi;
  group.rotation.y = grab.groupStartRotY + phi;
  const px = grab.groupStartPosition.x - grab.pivot.x;
  const pz = grab.groupStartPosition.z - grab.pivot.z;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  group.position.set(
    grab.pivot.x + px * cos + pz * sin,
    grab.groupStartPosition.y,
    grab.pivot.z - px * sin + pz * cos
  );
  editor.renderScene?.();
}

// Typed angle buffer (degrees) -> radians, or null when not parsable.
export function parseRotateAngleBuffer(buffer) {
  if (!buffer) return null;
  const deg = parseFloat(String(buffer).replace(",", "."));
  if (!Number.isFinite(deg)) return null;
  return (deg * Math.PI) / 180;
}
