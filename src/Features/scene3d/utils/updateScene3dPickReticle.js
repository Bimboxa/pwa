// Moves / hides the Scene3dPickReticle <g> of a drawing overlay.
// screen: {sx, sy} in the overlay's pixel space, or null to hide.
export default function updateScene3dPickReticle(element, screen) {
  if (!element) return;
  if (!screen) {
    element.style.display = "none";
    return;
  }
  element.setAttribute("transform", `translate(${screen.sx}, ${screen.sy})`);
  element.style.display = "block";
}
