import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import ToolbarMapEditorLocatedEntities from "./ToolbarMapEditorLocatedEntities";
import ToolbarMapEditorBlueprint from "Features/blueprints/components/ToolbarMapEditorBlueprint";
import ToolbarAnnotationInMapEditor from "Features/annotations/components/ToolbarAnnotationInMapEditor";
import ToolbarSelectedEntity from "Features/entities/components/ToolbarSelectedEntity";

export default function ToolbarMapEditor({ svgElement }) {
  // data

  const { value: listing } = useSelectedListing();
  const selectedItem = useSelector((s) => s.selection.selectedItem);

  // helpers

  const type = listing?.entityModel?.type;

  // helper - toolbar

  let toolbar = type;

  if (selectedItem?.type === "ENTITY") {
    toolbar = "SELECTED_ENTITY";
  }

  return (
    <>
      {/* {type === "LOCATED_ENTITY" && <ToolbarMapEditorLocatedEntities />} */}
      {/* {toolbar === "SELECTED_ENTITY" && <ToolbarSelectedEntity />} */}
      {/* {toolbar === "LOCATED_ENTITY" && <ToolbarAnnotationInMapEditor />} */}
      {toolbar === "BLUEPRINT" && (
        <ToolbarMapEditorBlueprint svgElement={svgElement} />
      )}
    </>
  );
}
