// Groups listings by their entityModel type, for panels that display every
// listing of a scope whatever its nature (base maps, annotations, business
// objects, exports...).
//
// appConfig.features.entityModelTypes only declares the types an org exposes
// in the create-listing dialog (BASE_MAP / LOCATED_ENTITY / BLUEPRINT for
// most of them), so it cannot be the only source of labels here: the fallback
// map below covers every type of the entityModelsObject catalog, and an
// unknown type falls back to the entityModel name carried by the listing.

const DEFAULT_LABEL_BY_TYPE = {
  LOCATED_ENTITY: "Listes d'objets",
  BUSINESS_OBJECT: "Ouvrages",
  BASE_MAP: "Fonds de plan",
  ANNOTATION_TEMPLATE: "Modèles d'annotation",
  PHOTO: "Photos",
  ZONING: "Zonages",
  ZONE_ENTITY: "Zones",
  PORTFOLIO_PAGE: "Pages de portfolio",
  BLUEPRINT: "Exports",
  LEGEND_ENTITY: "Légendes",
};

// Display order of the groups. A type absent from this list is appended
// after them, in the order it is met.
const TYPE_ORDER = [
  "LOCATED_ENTITY",
  "BUSINESS_OBJECT",
  "BASE_MAP",
  "ANNOTATION_TEMPLATE",
  "PHOTO",
  "ZONING",
  "ZONE_ENTITY",
  "PORTFOLIO_PAGE",
  "BLUEPRINT",
  "LEGEND_ENTITY",
];

const UNKNOWN_TYPE_KEY = "UNKNOWN";
const UNKNOWN_TYPE_LABEL = "Autres";

// listings: [listing], entityModelTypes: appConfig.features.entityModelTypes
// ([{type, name}], optional — org override of the labels).
// => [{type, label, listings}], groups without listings omitted.
export default function getListingGroupsByEntityModelType({
  listings,
  entityModelTypes,
} = {}) {
  if (!listings?.length) return [];

  // label overrides from the org appConfig

  const labelByType = {};
  entityModelTypes?.forEach((entityModelType) => {
    if (entityModelType?.type && entityModelType?.name) {
      labelByType[entityModelType.type] = entityModelType.name;
    }
  });

  // group

  const listingsByType = new Map();

  listings.forEach((listing) => {
    const type = listing?.entityModel?.type ?? UNKNOWN_TYPE_KEY;
    if (!listingsByType.has(type)) listingsByType.set(type, []);
    listingsByType.get(type).push(listing);
  });

  // order: the known types first, then the others in encounter order

  const metTypes = [...listingsByType.keys()];
  const orderedTypes = [
    ...TYPE_ORDER.filter((type) => listingsByType.has(type)),
    ...metTypes.filter((type) => !TYPE_ORDER.includes(type)),
  ];

  // label: org override > default map > entityModel name > raw type

  return orderedTypes.map((type) => {
    const groupListings = listingsByType.get(type);
    const label =
      labelByType[type] ??
      DEFAULT_LABEL_BY_TYPE[type] ??
      groupListings[0]?.entityModel?.name ??
      (type === UNKNOWN_TYPE_KEY ? UNKNOWN_TYPE_LABEL : type);

    return { type, label, listings: groupListings };
  });
}
