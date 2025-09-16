export default function ToolbarMapEditorBlueprint({ svgElement }) {
  // strings

  const createS = "Nouveau plan";
  const updateS = "Mettre à jour";

  // handlers

  function handleCreateClick() {
    console.log("create");
  }

  <ButtonGeneric label={createS} onClick={handleCreateClick} />;
}
