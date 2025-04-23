import store from "App/store";

export default function getRemoteItemPath({type, item}) {
  const remoteContainer = store.getState().sync.remoteContainer;
  const projectsById = store.getState().projects.projectsById;
  const listingsById = store.getState().listings.listingsById;
  const scopesById = store.getState().scopes.scopesById;

  if (!remoteContainer || !item) return null;

  const getProject = (id) => projectsById[id];
  const getListing = (id) => listingsById[id];
  const getScope = (id) => scopesById[id];

  const basePath = (clientRef) =>
    `${remoteContainer.projectsPath}/${clientRef}`;
  const dataPath = (clientRef) => `${basePath(clientRef)}/_data`;

  let path;
  let fileName;

  switch (type) {
    case "PROJECT": {
      fileName = "_project.json";
      path = `${dataPath(item.clientRef)}/_project.json`;
      break;
    }

    case "SCOPE": {
      const project = getProject(item.projectId);
      fileName = `_scope_${item.id}.json`;
      path = `${dataPath(project.clientRef)}/_scope_${item.id}.json`;
      break;
    }

    case "LISTING": {
      const project = getProject(item.projectId);
      fileName = `_listing_${item.id}.json`;
      path = `${dataPath(project.clientRef)}/_listing_${item.id}.json`;
      break;
    }

    case "RELS_SCOPE_ITEM": {
      const scope = getScope(item.scopeId);
      const project = getProject(scope.projectId);
      fileName = `_relsScopeItem_${item.scopeId}.json`;
      path = `${dataPath(project.clientRef)}/_relsScopeItem_${
        item.scopeId
      }.json`;
      break;
    }

    case "ENTITY": {
      const listing = getListing(item.listingId);
      const project = getProject(listing.projectId);
      fileName = `_${item.createdBy}.json`;
      path = `${basePath(project.clientRef)}/_listings/_data_${
        item.listingId
      }/_${item.createdBy}.json`;
    }

    case "FILE": {
      const listing = getListing(item.listingId);
      const project = getProject(listing.projectId);
      const base = `${basePath(project.clientRef)}/_listings/_${listing.key}_${
        item.listingId
      }`;
      const folder = item.isImage
        ? `_images_${item.createdBy}`
        : `_files_${item.createdBy}`;

      fileName = item.name;
      path = `${base}/${folder}/${item.name}`;
    }

    default:
      path = null;
  }

  return {path, fileName};
}
