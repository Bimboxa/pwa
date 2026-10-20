import useBaseMapsGrid3d from "../hooks/useBaseMapsGrid3d";
import useBaseMapsGrid3dHotkey from "../hooks/useBaseMapsGrid3dHotkey";
import useBaseMapsGrid3dPointer from "../hooks/useBaseMapsGrid3dPointer";

// Renders nothing: hosts the hooks of the 3D base maps grid in a child of
// MainThreedEditor, so their state (base maps, eyes, grid mode) never
// re-renders the editor itself. Mounted while a 3D editor is displayed and
// its renderer is ready.
// `countByBaseMapId`: annotations built in the 3D scene per base map (the
// badges of the Dessin module's sheets).
export default function BaseMapsGrid3dController({
  tooltipApiRef,
  countByBaseMapId,
}) {
  useBaseMapsGrid3d({ countByBaseMapId });
  useBaseMapsGrid3dHotkey();
  useBaseMapsGrid3dPointer({ tooltipApiRef });

  return null;
}
