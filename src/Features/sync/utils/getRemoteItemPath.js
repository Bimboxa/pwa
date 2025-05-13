import store from "App/store";
import db from "App/db/db";

import {syncFileByItemType} from "../syncConfig";
import {resolveFilePath} from "./resolversPath";

export default async function getRemoteItemPath({type, item}) {
  const syncFile = syncFileByItemType[type];
  const folderTemplate = syncFile.remoteFolder;
  const fileTemplate = syncFile.remoteFile;

  const remoteContainer = store.getState().sync.remoteContainer;

  const projectsById = store.getState().projects.projectsById;
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
      const project = projectsById[item.projectId];
      const context = {remoteContainer, project};
      path = resolveFilePath({folderTemplate, fileTemplate, context, item});
      break;
    }

    case "IMAGE": {
      const listing = await db.listings.get(item.listingId);
      const project = await db.projects.get(listing.projectId);
      const context = {remoteContainer, project};
      path = resolveFilePath({folderTemplate, fileTemplate, context, item});
      break;
    }

    default:
      path = null;
  }

  return {path};
}
