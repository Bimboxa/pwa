import useMeshPaintsResync from "Features/meshPaint/hooks/useMeshPaintsResync";

// Mount point of the painted parts re-sync (« Pinceau ») in the 3D editor —
// a component of its own so the paint rows' live query never re-renders
// MainThreedEditor.
export default function MeshPaintsResyncThreed() {
  useMeshPaintsResync();

  // render

  return null;
}
