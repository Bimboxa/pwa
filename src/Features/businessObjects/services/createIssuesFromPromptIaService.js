import { nanoid } from "@reduxjs/toolkit";
import { generateNKeysBetween } from "fractional-indexing";

import db from "App/db/db";

import createBusinessObjectListingService from "./createBusinessObjectListingService";

import buildPromptIaBusinessObjectRows from "../utils/buildPromptIaBusinessObjectRows";
import { BUSINESS_OBJECT_STATUS } from "../utils/getBusinessObjectStatus";

export const ISSUES_LISTING_NAME = "Points d'attention";

// Same digit-only keys as buildPromptIaBusinessObjectRows.
const SORT_INDEX_DIGITS = "0123456789";

async function findIssuesListing({ projectId, scopeId }) {
  const listings = await db.listings
    .where("projectId")
    .equals(projectId)
    .toArray();
  return (
    listings.find(
      (l) =>
        !l.deletedAt &&
        l.scopeId === scopeId &&
        l.entityModelKey === "businessObject" &&
        l.businessObjectType === "ISSUE" &&
        l.name === ISSUES_LISTING_NAME
    ) ?? null
  );
}

// Keys following the last root row of the listing: the new issues go below
// the existing ones.
async function appendSortIndexes({ listing, rows }) {
  const lastSortIndex = (
    await db.businessObjects.where("listingId").equals(listing.id).toArray()
  )
    .filter((o) => !o.deletedAt && !o.parentId && o.sortIndex != null)
    .map((o) => o.sortIndex)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .pop();
  if (!lastSortIndex) return rows;
  let keys;
  try {
    keys = generateNKeysBetween(
      lastSortIndex,
      null,
      rows.length,
      SORT_INDEX_DIGITS
    );
  } catch {
    // the last row carries a key of the default (base 62) charset
    keys = generateNKeysBetween(lastSortIndex, null, rows.length);
  }
  return rows.map((row, index) => ({ ...row, sortIndex: keys[index] }));
}

/**
 * Writes the issues of a Prompt IA result as OPEN rows of the scope's listing
 * of type ISSUE (« Points d'attention »). The links (annotations, resources)
 * are the caller's: it gets the rows back, one per item, same order.
 *
 * Hook-free. The scope must be the selected one (db guards).
 *
 * @param {Object} params
 * @param {string} params.projectId
 * @param {string} params.scopeId
 * @param {Object} params.appConfig
 * @param {Array<{id?: string, ref?: string, label: string,
 *   description?: string|null}>} params.items - flat issues
 * @param {boolean} [params.reuseListing=false] - true: append to the
 *   existing « Points d'attention » listing of the scope when there is one
 * @param {Object} [params.rowProps] - spread onto every created row
 * @returns {Promise<{listing: Object, rows: Object[],
 *   createdListing: boolean}>}
 */
export default async function createIssuesFromPromptIaService({
  projectId,
  scopeId,
  appConfig,
  items,
  reuseListing = false,
  rowProps = null,
}) {
  let listing = reuseListing
    ? await findIssuesListing({ projectId, scopeId })
    : null;
  const createdListing = !listing;
  if (!listing)
    listing = await createBusinessObjectListingService({
      projectId,
      scopeId,
      name: ISSUES_LISTING_NAME,
      typeKey: "ISSUE",
      appConfig,
    });

  let rows = buildPromptIaBusinessObjectRows({
    listing,
    items: (items ?? []).map((item, index) => ({
      ref: `issue_${index}`,
      parentRef: null,
      ...item,
    })),
    newId: nanoid,
  }).map((row) => ({
    ...row,
    status: BUSINESS_OBJECT_STATUS.OPEN,
    ...(rowProps ?? {}),
  }));
  if (!createdListing) rows = await appendSortIndexes({ listing, rows });

  if (rows.length) await db.businessObjects.bulkAdd(rows);
  return { listing, rows, createdListing };
}
