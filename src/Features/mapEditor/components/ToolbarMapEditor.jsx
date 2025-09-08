import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import ToolbarMapEditorLocatedEntities from "./ToolbarMapEditorLocatedEntities";

export default function ToolbarMapEditor() {
  // data

  const { value: listing } = useSelectedListing();

  // helpers

  const type = listing?.entityModel?.type;

  return (
    <>{type === "LOCATED_ENTITY" && <ToolbarMapEditorLocatedEntities />}</>
  );
}
