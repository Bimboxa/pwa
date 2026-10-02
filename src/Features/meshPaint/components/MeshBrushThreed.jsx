import { useSelector } from "react-redux";

import { selectIsMeshBrushActive } from "Features/meshPaint/utils/meshBrushSelectors";

import MeshBrushOverlayThreed from "Features/meshPaint/components/MeshBrushOverlayThreed";
import useMeshBrushPointerHandlers from "Features/meshPaint/hooks/useMeshBrushPointerHandlers";

// « Pinceau » (MESH_BRUSH) of the 3D editor: pointer handling + cursor
// helper, mounted only while the brush is armed — its data (painted parts,
// templates) is only read then, and its re-renders stay out of
// MainThreedEditor.
export default function MeshBrushThreed() {
  // data

  const active = useSelector(selectIsMeshBrushActive);

  // render

  return active ? <MeshBrushActiveThreed /> : null;
}

function MeshBrushActiveThreed() {
  useMeshBrushPointerHandlers();

  return <MeshBrushOverlayThreed />;
}
