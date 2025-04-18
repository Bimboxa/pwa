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

  switch (type) {
    case "PROJECT": {
      return `${dataPath(item.clientRef)}/_project.json`;
    }

    case "SCOPE": {
      const project = getProject(item.projectId);
      return `${dataPath(project.clientRef)}/_scope_${item.id}.json`;
    }

    case "LISTING": {
      const project = getProject(item.projectId);
      return `${dataPath(project.clientRef)}/_listing_${item.id}.json`;
    }

    case "RELS_SCOPE_ITEM": {
      const scope = getScope(item.scopeId);
      const project = getProject(scope.projectId);
      return `${dataPath(project.clientRef)}/_relsScopeItem_${
        item.scopeId
      }.json`;
    }

    case "ENTITY": {
      const listing = getListing(item.listingId);
      const project = getProject(listing.projectId);
      return `${basePath(project.clientRef)}/_listings/_${listing.key}_${
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
      return `${base}/${folder}/${item.name}`;
    }

    default:
      return null;
  }
}
