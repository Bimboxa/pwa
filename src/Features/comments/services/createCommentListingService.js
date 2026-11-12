import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import {
  COMMENT_ENTITY_MODEL,
  COMMENT_ENTITY_MODEL_KEY,
  COMMENTS_MODULE_KEY,
  isCommentListing,
} from "../constants/commentEntityModel";

import enableScopeModuleService from "Features/scopeConfig/services/enableScopeModuleService";

// Creates a COMMENT listing ("Liste de commentaires") bound to a scope. Plain
// service so the Krto creation flow (Commentaires option) can call it outside
// a hook. The Comments module is the only one editing the listing, so
// creating it also enables the module for the scope (idempotent).
export default async function createCommentListingService({
  projectId,
  scopeId,
  name,
  appConfig,
} = {}) {
  if (!projectId || !scopeId) return null;

  // Rank after the last comment listing of the project (fractional indexing).
  const commentListings = (
    await db.listings.where("projectId").equals(projectId).toArray()
  ).filter((l) => !l.deletedAt && isCommentListing(l));
  const lastRank = commentListings
    .map((l) => l.rank)
    .filter((r) => r != null)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .pop();

  const scopeCount = commentListings.filter(
    (l) => l.scopeId === scopeId
  ).length;
  const defaultName = COMMENT_ENTITY_MODEL.defaultListingName;

  const listing = {
    id: nanoid(),
    projectId,
    scopeId,
    name:
      name?.trim() ||
      (scopeCount ? `${defaultName} ${scopeCount + 1}` : defaultName),
    rank: generateKeyBetween(lastRank ?? null, null),
    entityModelKey: COMMENT_ENTITY_MODEL_KEY,
    entityModel: COMMENT_ENTITY_MODEL,
    table: COMMENT_ENTITY_MODEL.defaultTable,
    canCreateItem: false,
  };

  await db.listings.add(listing);

  await enableScopeModuleService({
    scopeId,
    projectId,
    moduleKey: COMMENTS_MODULE_KEY,
    appConfig,
  });

  return listing;
}
