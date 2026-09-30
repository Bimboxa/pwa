import useMesh3dPartsHighlight from "../hooks/useMesh3dPartsHighlight";

// Highlight of the selected faces / edges of a mesh annotation in the 3D
// scene (renders nothing). A component of its own on purpose: it subscribes
// to the selection, and MainThreedEditor must not re-render on selection
// changes (that would reload every annotation object).
export default function Mesh3dPartsHighlightThreed({ enabled }) {
  useMesh3dPartsHighlight({ enabled });
  return null;
}
