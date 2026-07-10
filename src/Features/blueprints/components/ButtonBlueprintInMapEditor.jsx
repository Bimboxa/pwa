import { useSelector } from "react-redux";

import useProjectBlueprintsListings from "../hooks/useProjectBlueprintsListings";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import ButtonCreateBlueprint from "./ButtonCreateBlueprint";

export default function ButtonBlueprintInMapEditor() {
  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const blueprintsListings = useProjectBlueprintsListings();

  // Only used for the has-annotations check — the deprecated useAnnotations
  // hook ignored annotations without an entityId (e.g. procedure-created ones).
  const annotations = useAnnotationsV2({
    caller: "ButtonBlueprintInMapEditor",
    filterByBaseMapId: baseMapId,
  });

  // helper - render

  let render = null;

  if (!blueprintsListings?.length > 0 && annotations?.length > 0)
    render = "CREATE";

  return <>{render === "CREATE" && <ButtonCreateBlueprint />}</>;
}
