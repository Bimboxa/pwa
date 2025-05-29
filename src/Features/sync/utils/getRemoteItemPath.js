import db from "App/db/db";

import {resolveFilePath} from "./resolversPath";
import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";

export default async function getRemoteItemPath({type, item, remoteContainer}) {
  const syncFileTypeByType = {
    PROJECT: "PROJECT",
    SCOPE: "SCOPE",
    LISTING: "LISTING",
    ENTITY: "ENTITIES",
    FILE: "FILE",
  };
  try {
    //
    const templates = computeSyncFilePathTemplates({
      syncFileType: syncFileTypeByType[type],
      fileType: item.fileType,
    });

    const folderTemplate = templates.remoteFolder;
    const fileTemplate = templates.remoteFile;

    //const projectsById = store.getState().projects.projectsById;
    //const listingsById = store.getState().listings.listingsById;

    if (!remoteContainer || !item) return null;

    let path;

    switch (type) {
      case "PROJECT": {
        const context = {remoteContainer};
        path = resolveFilePath({folderTemplate, fileTemplate, context, item});
        break;
      }

      case "SCOPE": {
        const project = await db.projects.get(item.projectId);
        console.log("[getRemoteItemPath] scope", item, project);
        const context = {remoteContainer, project};
        path = resolveFilePath({folderTemplate, fileTemplate, context, item});
        break;
      }

      case "LISTING": {
        const project = await db.projects.get(item.projectId);
        const context = {remoteContainer, project};
        console.log("[getRemoteItemPath] scope", item, context);
        path = resolveFilePath({folderTemplate, fileTemplate, context, item});
        break;
      }

      case "ENTITY": {
        const listing = await db.listings.get(item.listingId);
        const project = await db.projects.get(listing.projectId);
        const context = {remoteContainer, project};
        console.log("[getRemoteItemPath] entity", item, context);
        path = resolveFilePath({folderTemplate, fileTemplate, context, item});
        break;
      }

      case "FILE": {
        console.log("debug_333", item);
        const listing = await db.listings.get(item.listingId);
        const project = await db.projects.get(listing.projectId);
        const context = {remoteContainer, project};
        path = resolveFilePath({folderTemplate, fileTemplate, context, item});
        break;
      }

      // case "IMAGE": {
      //   const listing = await db.listings.get(item.listingId);
      //   const project = await db.projects.get(listing.projectId);
      //   const context = {remoteContainer, project};
      //   path = resolveFilePath({folderTemplate, fileTemplate, context, item});
      //   break;
      // }

      default:
        path = null;
    }

    return {path};
  } catch (e) {
    console.error("[getRemoteItemPath] error_33", item, type);
  }
}
