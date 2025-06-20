import PanelSelectorEntity from "Features/entities/components/PanelSelectorEntity";
import React from "react";

export default function FieldEntityVariantMobile({
  value,
  onChange,
  entities,
  entitiesListing,
}) {
  // handlers

  function handleSelectionChange(selectionId) {
    onChange({id: selectionId});
  }

  return (
    <PanelSelectorEntity
      selectedEntityId={value?.id}
      entities={entities}
      entitiesListing={entitiesListing}
      onSelectionChange={handleSelectionChange}
    />
  );
}
