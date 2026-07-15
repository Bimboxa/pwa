// Effective 3D opacity of one baseMap: the per-baseMap override set from the
// baseMap properties panel wins over the global `baseMapOpacityIn3d`.
// `threedEditorState` is `state.threedEditor` (redux).
export default function getBaseMapOpacityIn3d(threedEditorState, baseMapId) {
  return (
    threedEditorState?.opacityByBaseMapIdIn3d?.[baseMapId] ??
    threedEditorState?.baseMapOpacityIn3d ??
    1
  );
}
