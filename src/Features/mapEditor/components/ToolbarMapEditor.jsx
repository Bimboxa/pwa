import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import ToolbarMapEditorLocatedEntities from "./ToolbarMapEditorLocatedEntities";
import ToolbarMapEditorBlueprint from "Features/blueprints/components/ToolbarMapEditorBlueprint";

export default function ToolbarMapEditor({ svgElement }) {
  // data

  const { value: listing } = useSelectedListing();

  // helpers

  const type = listing?.entityModel?.type;

  console.log("debug_0910 listing", listing);

  return (
    <>
      {type === "LOCATED_ENTITY" && <ToolbarMapEditorLocatedEntities />}
      {type === "BLUEPRINT" && (
        <ToolbarMapEditorBlueprint svgElement={svgElement} />
      )}
    </>
  );
}
