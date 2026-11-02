import { useDispatch, useSelector } from "react-redux";

import { setCameraOrtho } from "Features/threedEditor/threedEditorSlice";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";
import IconCameraOrtho from "Features/icons/IconCameraOrtho";

// Bottom bar toggle of the 3D view (SectionBaseMapsBottomBarControls), right
// of « Séparer les surfaces en contact »: « Caméra ortho ». OFF (default)
// renders the scene through the perspective camera; ON switches the 3D view
// to an orthographic (parallel) projection, whatever the viewing angle
// (threedEditor.cameraOrtho → ControlsManager.setOrthographic, synced by
// MainThreedEditor). The walk mode (first person) always runs in
// perspective, so the toggle is disabled while walking — the preference is
// applied again on exit.
export default function ButtonToggleCameraOrtho() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Caméra ortho (projection parallèle)";

  // data

  const active = useSelector((s) => s.threedEditor.cameraOrtho);
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);

  // handlers

  function handleClick() {
    dispatch(setCameraOrtho(!active));
  }

  // render

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<IconCameraOrtho />}
      active={active}
      disabled={walkActive}
      onClick={handleClick}
    />
  );
}
