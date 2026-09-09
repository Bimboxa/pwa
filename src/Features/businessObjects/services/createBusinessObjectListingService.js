import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import { BUSINESS_OBJECT_ENTITY_MODEL } from "../constants/businessObjectEntityModel";
import {
  DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  getBusinessObjectType,
} from "../data/businessObjectTypesCatalog";
import { getBusinessObjectsModuleKey } from "../utils/businessObjectModuleKeys";

import enableScopeModuleService from "Features/scopeConfig/services/enableScopeModuleService";

// Creates a BUSINESS_OBJECT listing ("Ouvrages" list). Plain service so the
// Krto creation flow (DPGF option) can call it outside a hook. `typeKey` is
// the business object type of the listing (businessObjectTypesCatalog) —
// the module of that type is the only one displaying it, so creating the
// listing also enables that module for the scope (idempotent).
// `canLocateBusinessObjects` opts the listing into the main-location flow
// (utils/canLocateBusinessObjects): written only when true, missing = false.
export default async function createBusinessObjectListingService({
  projectId,
  scopeId,
  name,
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  canLocateBusinessObjects = false,
  appConfig,
} = {}) {
  const entityModel =
    appConfig?.entityModelsObject?.businessObject ??
    BUSINESS_OBJECT_ENTITY_MODEL;

  // Rank after the last existing business-object listing of the project
  // (listings are ordered by rank — fractional indexing).
  const projectListings = (
    await db.listings.where("projectId").equals(projectId).toArray()
  ).filter((l) => !l.deletedAt && l.entityModelKey === "businessObject");
  const lastRank = projectListings
    .map((l) => l.rank)
    .filter((r) => r != null)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .pop();
  const rank = generateKeyBetween(lastRank ?? null, null);

  const defaultLabel =
    getBusinessObjectType(typeKey)?.defaultLabel ?? "Ouvrages";

  const listing = {
    id: nanoid(),
    projectId,
    scopeId,
    name: name || `${defaultLabel} ${projectListings.length + 1}`,
    rank,
    entityModelKey: "businessObject",
    entityModel,
    // Missing on listings created before the types existed => STANDARD at
    // read time (useBusinessObjectListings). Never backfilled.
    businessObjectType: typeKey,
    table: entityModel?.defaultTable || "businessObjects",
    canCreateItem: false,
    // v1 only handles tree listings (parentId + fractional sortIndex).
    isTree: true,
    ...(canLocateBusinessObjects ? { canLocateBusinessObjects: true } : {}),
  };

  await db.listings.add(listing);

  await enableScopeModuleService({
    scopeId,
    projectId,
    moduleKey: getBusinessObjectsModuleKey(typeKey),
    appConfig,
  });

  return listing;
}
