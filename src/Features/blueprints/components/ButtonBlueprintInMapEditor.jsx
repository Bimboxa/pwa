import useProjectBlueprintsListings from "../hooks/useProjectBlueprintsListings";
import ButtonCreateBlueprint from "./ButtonCreateBlueprint";

export default function ButtonBlueprintInMapEditor() {
  // data

  const blueprintsListings = useProjectBlueprintsListings();

  // helper - render

  let render = null;

  if (!blueprintsListings?.length > 0) render = "CREATE";

  return <>{render === "CREATE" && <ButtonCreateBlueprint />}</>;
}
