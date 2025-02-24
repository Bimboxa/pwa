export default function getMapEditorBbox(mapEditor) {
  // edge case
  if (!mapEditor.stage) return null;

  // main
  return mapEditor.stage.container().getBoundingClientRect();
}
