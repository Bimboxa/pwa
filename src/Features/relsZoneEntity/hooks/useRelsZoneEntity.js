import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useListings from "Features/listings/hooks/useListings";

import db from "App/db/db";

export default function useRelsZoneEntity({ entityId }) {
  // data

  const updatedAt = useSelector(
    (s) => s.relsZoneEntity.relsZoneEntityUpdatedAt
  );

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const listings = useListings({
    //filterByScopeId: scopeId,
    filterByProjectId: projectId,
    relsZoneEntityListings: true,
  });

  console.log("debug_0202_listings", listings);

  // default relations

  const rels_default = useLiveQuery(async () => {
    if (entityId) {
      const rels = await db.relsZoneEntity
        .where("entityId")
        .equals(entityId)
        .toArray();

      return rels;
    }
  }, [entityId, updatedAt]);

  // custom relations

  const rels_custom = useLiveQuery(async () => {
    if (listings?.length > 0) {
      let _rels_custom = [];
      for (let listing of listings) {
        const entityField = listing?.entityModel?.relsZoneEntity?.entityField;
        const zoneField = listing?.entityModel?.relsZoneEntity?.zoneField;
        if (entityField) {
          const relEntities = await db.entities
            .where("listingId")
            .equals(listing.id)
            .toArray()
          const rels = relEntities
            .filter((entity) => entity[entityField]?.id === entityId)
            .map((entity) => {
              return {
                id: entity.id,
                zoningId: entity[zoneField]?.listingId,
                zoneId: entity[zoneField]?.id,
                listingId: entity.listingId,
                entityId: entity.id,
                relId: entity.id,
                relListingId: entity.listingId,
              };
            });

          _rels_custom = [..._rels_custom, ...rels];
        }
      }
      return _rels_custom;
    }
  }, [entityId, updatedAt, listings?.length]);

  // return

  console.log("debug_1411_rels_custom", rels_custom);

  return [...(rels_default ?? []), ...(rels_custom ?? [])];
}
