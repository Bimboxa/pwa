import { useDispatch, useSelector } from "react-redux";

import { setAntiAliasingShrink } from "Features/threedEditor/threedEditorSlice";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";
import IconSeparateSurfaces from "Features/icons/IconSeparateSurfaces";

// Bottom bar toggle of the 3D view (SectionBaseMapsBottomBarControls):
// « Séparer les surfaces en contact ». OFF
// (default) renders every element at its drawn dimensions; ON applies the
// render-only anti-aliasing tweaks — the 10 mm footprint / 5 mm top shrink
// of CM POLYLINE and STRIP elements and the POLYGON « Delta offset 3D » lift
// (threedEditor.antiAliasingShrink, same state as the switch of the 3D
// settings panel). Toggling rebuilds the annotation objects (build epoch).
export default function ButtonToggleAntiAliasingShrink() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Séparer les surfaces en contact (anti-crénelage)";

  // data

  const active = useSelector((s) => s.threedEditor.antiAliasingShrink);

  // handlers

  function handleClick() {
    dispatch(setAntiAliasingShrink(!active));
  }

  // render

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<IconSeparateSurfaces />}
      active={active}
      onClick={handleClick}
    />
  );
}
