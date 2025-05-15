import db from "App/db/db";

export default async function computeSyncScopeFromSyncFiles(syncFiles) {
  const syncScope = {};

  const listingsIds = syncFiles
    .filter((sf) => sf.listingId)
    .map((sf) => sf.listingId);

  const listings = await db.listings.bulkGet(listingsIds);

  const syncFileTypes = [...new Set(syncFiles.map((sf) => sf.syncFileType))];
  const fileTypes = [
    ...new Set(syncFiles.filter((sf) => sf.fileType).map((sf) => sf.fileType)),
  ];

  // PROJECT
  if (syncFileTypes.includes("PROJECT")) {
    syncScope.PROJECT = {direction: "PUSH"};
  }

  // SCOPE
  if (syncFileTypes.includes("SCOPE")) {
    syncScope.SCOPE = {direction: "PUSH"};
  }

  // LISTINGS
  if (syncFileTypes.includes("LISTING")) {
    syncScope.LISTINGS = {direction: "PUSH", listings};
  }
  // ENTITIES
  if (syncFileTypes.includes("ENTITIES")) {
    syncScope.ENTITIES = {direction: "PUSH", listings};
  }
  // FILES
  if (syncFileTypes.includes("FILE")) {
    syncScope.LISTINGS = {direction: "PUSH", listings, fileTypes};
  }

  return syncScope;
}
