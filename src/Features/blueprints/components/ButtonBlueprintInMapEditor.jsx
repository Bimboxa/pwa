import { useSelector } from "react-redux";

import useProjectBlueprintsListings from "../hooks/useProjectBlueprintsListings";
import useAnnotations from "Features/annotations/hooks/useAnnotations";

import ButtonCreateBlueprint from "./ButtonCreateBlueprint";

export default function ButtonBlueprintInMapEditor() {
  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const blueprintsListings = useProjectBlueprintsListings();

  const annotations = useAnnotations({ filterByBaseMapId: baseMapId });

  // helper - render

  let render = null;

  if (!blueprintsListings?.length > 0 && annotations?.length > 0)
    render = "CREATE";

  return <>{render === "CREATE" && <ButtonCreateBlueprint />}</>;
}
