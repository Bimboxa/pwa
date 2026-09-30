import { useDispatch, useSelector } from "react-redux";

import { closeScene3dReloadDialog } from "../scene3dSlice";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

import DialogCreateBaseMapFromScene3d from "./DialogCreateBaseMapFromScene3d";

// "Recharger les fichiers" of a scan base map (redux-driven, mounted once
// in MainAppLayout): the creation dialog in reload mode.
export default function DialogReloadScene3dBaseMap() {
  const dispatch = useDispatch();

  const reloadDialog = useSelector((s) => s.scene3d.reloadDialog);
  const baseMap = useBaseMap({ id: reloadDialog?.baseMapId });

  const open = Boolean(reloadDialog && baseMap?.scene3d);
  if (!open) return null;

  return (
    <DialogCreateBaseMapFromScene3d
      open
      onClose={() => dispatch(closeScene3dReloadDialog())}
      reloadBaseMap={baseMap}
    />
  );
}
