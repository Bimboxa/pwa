import { BASE_MAPS_IMAGE_MODE } from "Features/baseMaps/constants/baseMapsImageMode";

// Every base map image hidden in the 3D scene: the 3D "Masquer les fonds de
// plan" switch (threedEditor.hideBaseMaps) OR the global image mode NONE
// (viewers.baseMapsImageMode). The groups — and their annotations — stay
// rendered.
export default function selectHideBaseMapImagesIn3d(state) {
  return (
    Boolean(state.threedEditor?.hideBaseMaps) ||
    state.viewers?.baseMapsImageMode === BASE_MAPS_IMAGE_MODE.NONE
  );
}
