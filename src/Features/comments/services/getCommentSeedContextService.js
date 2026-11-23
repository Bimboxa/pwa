import db from "App/db/db";

import { getTemplateRefKey } from "../utils/commentSeedRefs";

const isLive = (row) => Boolean(row) && !row.deletedAt;

// Key <-> id maps of a scope, for the infos seeded by a configuration (see
// utils/commentSeedRefs.js): the keyed listings of the scope, the keyed
// annotation templates of those listings and the keyed base maps of the
// scope (`keyScopeId`). Both directions are returned: keys → ids to bind a
// seed, ids → keys to export one.
export default async function getCommentSeedContextService({
  projectId,
  scopeId,
}) {
  const [listings, templates, baseMaps] = await Promise.all([
    db.listings.where("scopeId").equals(scopeId).toArray(),
    db.annotationTemplates.where("projectId").equals(projectId).toArray(),
    db.baseMaps.where("projectId").equals(projectId).toArray(),
  ]);

  const listingIdByKey = new Map();
  const listingKeyById = new Map();
  for (const listing of listings) {
    if (!isLive(listing) || !listing.key) continue;
    if (!listingIdByKey.has(listing.key))
      listingIdByKey.set(listing.key, listing.id);
    listingKeyById.set(listing.id, listing.key);
  }

  const templateIdByRef = new Map();
  const templateRefById = new Map();
  for (const template of templates) {
    if (!isLive(template) || !template.templateKey) continue;
    const listingKey = listingKeyById.get(template.listingId);
    if (!listingKey) continue;
    const ref = { listingKey, templateKey: template.templateKey };
    const refKey = getTemplateRefKey(ref);
    if (!templateIdByRef.has(refKey)) templateIdByRef.set(refKey, template.id);
    templateRefById.set(template.id, ref);
  }

  // a key is unique within a scope; were it not, the oldest base map wins
  const baseMapByKey = new Map();
  const baseMapById = new Map();
  const liveBaseMaps = baseMaps
    .filter(isLive)
    .sort((a, b) => String(a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  for (const baseMap of liveBaseMaps) {
    baseMapById.set(baseMap.id, baseMap);
    if (!baseMap.key || baseMap.keyScopeId !== scopeId) continue;
    if (!baseMapByKey.has(baseMap.key)) baseMapByKey.set(baseMap.key, baseMap);
  }

  return {
    listingIdByKey,
    listingKeyById,
    templateIdByRef,
    templateRefById,
    baseMapByKey,
    baseMapById,
  };
}
