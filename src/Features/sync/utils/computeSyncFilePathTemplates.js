const fileTypeConfig = {
  IMAGE: {
    key: "image",
    path: "_images",
  },
};

export default function computeSyncFilePathTemplates({syncFileType, fileType}) {
  // for FILE, get _images, or _videos, or...
  const {path, key} = fileTypeConfig[fileType] ?? {};

  // helpers

  const pathsByType = {
    PROJECT: {
      remoteFolder: "{{remoteContainer.projectsPath}}/{{clientRef}}/_data",
      remoteFile: "_project.json",
    },
    SCOPE: {
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
      remoteFile: "_scope_{{id}}.json",
    },
    LISTING: {
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings",
      remoteFile: "_listing_{{id}}.json",
    },
    ENTITIES: {
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_entities/_listing_{{listingId}}",
      remoteFile: "_{{createdBy}}.json",
    },
    ZONING: {
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_zonings",
      remoteFile: "_{{listingId}}.json",
    },
    FILE: {
      remoteFolder: `{{remoteContainer.projectsPath}}/{{project.clientRef}}/${path}/_listing_{{listingId}}/_{{createdBy}}`,
      remoteFile: "{{fileName}}",
      pathSeparator: path,
    },
  };

  // result

  return pathsByType[syncFileType];
}
