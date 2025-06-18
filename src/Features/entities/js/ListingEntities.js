export default class ListingEntities {
  constructor({entitiesById, listing}) {}

  get nomenclature() {
    if (listing.type === "NOMENCLATURE") {
      return listing.metadata.nomenclature;
    }
  }

  resolveEntitiesProps(pros) {}
}
