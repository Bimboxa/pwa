import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import ToolbarMapEditorLocatedEntities from "./ToolbarMapEditorLocatedEntities";

export default function ToolbarMapEditor() {
  // data

  const { value: listing } = useSelectedListing();

  // helpers

  const type = listing?.entityModel?.type;

  console.log("debug_0910 listing", listing);

  return (
    <>{type === "LOCATED_ENTITY" && <ToolbarMapEditorLocatedEntities />}</>
  );
}
