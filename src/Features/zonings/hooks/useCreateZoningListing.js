import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

import { ZONING_ENTITY_MODEL } from "../constants/zoningEntityModel";

export default function useCreateZoningListing() {
  const appConfig = useAppConfig();

  const _projectId = useSelector((s) => s.projects.selectedProjectId);
  const _scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const create = async ({ projectId, scopeId, name } = {}) => {
    const entityModel =
      appConfig?.entityModelsObject?.zoning ?? ZONING_ENTITY_MODEL;
    const listingId = nanoid();

    const _projectIdFinal = projectId ?? _projectId;
    const _scopeIdFinal = scopeId ?? _scopeId;

    // Rank after the last existing zoning listing of the project
    // (listings are ordered by rank — fractional indexing).
    const projectListings = (
      await db.listings.where("projectId").equals(_projectIdFinal).toArray()
    ).filter((l) => !l.deletedAt && l.entityModelKey === "zoning");
    const lastRank = projectListings
      .map((l) => l.rank)
      .filter((r) => r != null)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .pop();
    const rank = generateKeyBetween(lastRank ?? null, null);

    // No top-level `type` field: the legacy sync pipeline keys off
    // listing.type === "ZONING" (blob zonings table). Only entityModel.type
    // identifies these listings.
    const listing = {
      id: listingId,
      projectId: _projectIdFinal,
      scopeId: _scopeIdFinal,
      name: name || `Zonage ${projectListings.length + 1}`,
      rank,
      entityModelKey: "zoning",
      entityModel,
      table: entityModel?.defaultTable || "zones",
      canCreateItem: false,
    };

    await db.listings.add(listing);
    return listing;
  };

  return create;
}
