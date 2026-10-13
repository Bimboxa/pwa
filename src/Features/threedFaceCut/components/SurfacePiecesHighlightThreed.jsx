import useSurfacePiecesHighlight from "../hooks/useSurfacePiecesHighlight";

// Highlight of the selected pieces of a cut surface host in the 3D scene
// (renders nothing). A component of its own, like Mesh3dPartsHighlightThreed:
// it subscribes to the selection, and MainThreedEditor must not re-render on
// selection changes.
export default function SurfacePiecesHighlightThreed({ enabled }) {
  useSurfacePiecesHighlight({ enabled });
  return null;
}
