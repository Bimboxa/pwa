import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import SectionLegendInListPanel from "Features/legend/components/SectionLegendEntityInListPanel";
import SectionLocatedEntitiesInListPanel from "Features/locatedEntities/components/SectionLocatedEntitiesInListPanel";
import SectionTreeZonesInListPanel from "Features/zones/components/SectionTreeZonesInListPanel";
import ButtonShowListingAnnotationTemplatesInLeftPanel from "Features/listings/components/ButtonShowListingAnnotationTemplatesInLeftPanel";

export default function PanelListingEntities({ listing }) {
  // helpers

  let type = "DEFAULT";
  if (listing?.entityModel?.type === "LEGEND_ENTITY") type = "LEGEND";
  if (listing?.entityModel?.type === "LOCATED_ENTITY") type = "LOCATED_ENTITY";
  if (listing?.entityModel?.type === "ZONE_ENTITY") type = "ZONE_ENTITY";

  // render

  return (
    <BoxFlexVStretch>
      <BoxFlexVStretch>
        {type === "DEFAULT" && <SectionListEntitiesInListPanel />}
        {type === "LEGEND" && <SectionLegendInListPanel listing={listing} />}
        {type === "LOCATED_ENTITY" && (
          <SectionLocatedEntitiesInListPanel listing={listing} />
        )}
        {type === "ZONE_ENTITY" && <SectionTreeZonesInListPanel />}
      </BoxFlexVStretch>

      {listing?.annotationTemplatesListingKey && (
        <ButtonShowListingAnnotationTemplatesInLeftPanel />
      )}
    </BoxFlexVStretch>
  );
}
