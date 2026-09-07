import db from "App/db/db";

// True when ANY local row still belongs to the project — not just the
// projects row, so a half-wiped project (projects row gone, scopes/listings
// left behind) is still detected and the verbatim import offers a wipe.
export default async function hasProjectLocalData(projectId) {
  if (!projectId) return false;
  if (await db.projects.get(projectId)) return true;
  if ((await db.scopes.where("projectId").equals(projectId).count()) > 0)
    return true;
  if ((await db.listings.where("projectId").equals(projectId).count()) > 0)
    return true;
  return false;
}
