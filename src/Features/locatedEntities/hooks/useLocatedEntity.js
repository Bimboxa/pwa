import {useSelector} from "react-redux";

export default function useLocatedEntity(options) {
  // options

  const withListing = options?.withListing;

  // data

  const locatedEntitiesMap = useSelector(
    (s) => s.locatedEntities.locatedEntitiesMap
  );

  const selectedLocatedEntityId = useSelector(
    (s) => s.locatedEntities.selectedLocatedEntityId
  );
  const editedLocatedEntity = useSelector(
    (s) => s.locatedEntities.editedLocatedEntity
  );
  const newLocatedEntity = useSelector(
    (s) => s.locatedEntities.newLocatedEntity
  );
  const isEditingLocatedEntity = useSelector(
    (s) => s.locatedEntities.isEditingLocatedEntity
  );

  // data - relations

  const listingsMap = useSelector((s) => s.listings.listingsMap);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);

  // helpers

  let entity = locatedEntitiesMap?.get(selectedLocatedEntityId);
  if (!selectedLocatedEntityId) {
    entity = {...newLocatedEntity, listingId: selectedListingId};
  }
  if (isEditingLocatedEntity) {
    entity = editedLocatedEntity;
  }

  // with ...

  if (withListing) {
    entity = {
      ...entity,
      listing: listingsMap?.get(entity?.listingId),
    };
  }

  // return

  return entity;
}
