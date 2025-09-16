import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { Add } from "@mui/icons-material";

export default function ToolbarMapEditorBlueprint({ svgElement }) {
  // strings

  const createS = "Nouveau plan";
  const updateS = "Mettre à jour";

  // handlers

  function handleCreateClick() {
    console.log("create");
  }

  return (
    <ButtonGeneric
      label={createS}
      onClick={handleCreateClick}
      variant="contained"
      startIcon={<Add />}
    />
  );
}
