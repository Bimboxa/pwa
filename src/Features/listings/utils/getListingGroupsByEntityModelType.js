import BUSINESS_OBJECT_TYPES, {
  DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
} from "Features/businessObjects/data/businessObjectTypesCatalog";

// Groups listings by their entityModel type, for panels that display every
// listing of a scope whatever its nature (base maps, annotations, business
// objects, exports...).
//
// BUSINESS_OBJECT is split further, one group per business object TYPE
// (STANDARD / NOMENCLATURE / PLANNING...): each type is its own family, with
// its own module, label and icon in the left band — a single "Ouvrages" group
// could not carry them. Those groups stay adjacent, in registry order, at the
// BUSINESS_OBJECT slot of TYPE_ORDER, and carry `businessObjectTypeKey` so the
// caller can resolve the per-scope module label / icon (hooks, hence not
// resolved here).
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

// Display order of the groups: the scope reads top-down as base maps first,
// then what is drawn on them, then what those drawings feed. A type absent
// from this list is appended after them, in the order it is met.
const TYPE_ORDER = [
  "BASE_MAP",
  "LOCATED_ENTITY",
  "BUSINESS_OBJECT",
  "ANNOTATION_TEMPLATE",
  "PHOTO",
  "ZONING",
  "ZONE_ENTITY",
  "PORTFOLIO_PAGE",
  "BLUEPRINT",
  "LEGEND_ENTITY",
];

const BUSINESS_OBJECT_TYPE = "BUSINESS_OBJECT";

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

  return orderedTypes.flatMap((type) => {
    const groupListings = listingsByType.get(type);
    const label =
      labelByType[type] ??
      DEFAULT_LABEL_BY_TYPE[type] ??
      groupListings[0]?.entityModel?.name ??
      (type === UNKNOWN_TYPE_KEY ? UNKNOWN_TYPE_LABEL : type);

    if (type === BUSINESS_OBJECT_TYPE) {
      return splitBusinessObjectGroups(groupListings, label);
    }

    return [{ key: type, type, label, listings: groupListings }];
  });
}

// One group per business object type met, in registry order; a listing whose
// businessObjectType is missing or unknown counts as the default type (same
// rule as getBusinessObjectTypeOfListing). `label` is the type's default —
// the caller overrides it with the resolved per-scope module label.
function splitBusinessObjectGroups(listings, fallbackLabel) {
  const knownKeys = new Set(BUSINESS_OBJECT_TYPES.map((t) => t.key));
  const byTypeKey = new Map();

  listings.forEach((listing) => {
    const rawKey = listing?.businessObjectType;
    const typeKey = knownKeys.has(rawKey)
      ? rawKey
      : DEFAULT_BUSINESS_OBJECT_TYPE_KEY;
    if (!byTypeKey.has(typeKey)) byTypeKey.set(typeKey, []);
    byTypeKey.get(typeKey).push(listing);
  });

  return BUSINESS_OBJECT_TYPES.filter((t) => byTypeKey.has(t.key)).map((t) => ({
    key: `${BUSINESS_OBJECT_TYPE}:${t.key}`,
    type: BUSINESS_OBJECT_TYPE,
    businessObjectTypeKey: t.key,
    label: t.defaultLabel ?? fallbackLabel,
    listings: byTypeKey.get(t.key),
  }));
}
