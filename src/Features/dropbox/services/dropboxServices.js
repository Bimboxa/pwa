import dropboxToGenericMetadata from "../utils/dropboxToGenericMetadata";

// SERVICES definition

const servicesProps = {
  // SEARCH

  searchFile: ({fileName, namespaceId}) => ({
    url: "https://api.dropboxapi.com/2/files/search_v2",
    body: {
      query: fileName,
      options: {
        filename_only: true,
        max_results: 1,
      },
    },
    headers: {"Content-Type": "application/json"},
    namespaceId,
    transformResult: (result) =>
      dropboxToGenericMetadata(result?.matches?.[0]?.metadata?.metadata),
  }),

  // FETCH

  fetchItemMetadata: ({path, namespaceId}) => ({
    url: "https://api.dropboxapi.com/2/files/get_metadata",
    body: {
      path,
    },
    headers: {"Content-Type": "application/json"},
    namespaceId,
    transformResult: (result) => dropboxToGenericMetadata(result),
  }),

  fetchFilesMetadataFromFolder: ({path, namespaceId}) => ({
    url: "https://api.dropboxapi.com/2/files/list_folder",
    body: {
      path,
    },
    headers: {"Content-Type": "application/json"},
    namespaceId,
    transformResult: (result) => {
      const targetFiles = result.entries.filter(
        (entry) => entry[".tag"] === "file"
      );
      return targetFiles.map((file) => dropboxToGenericMetadata(file));
    },
  }),

  fetchFoldersMetadataFromFolder: ({path, namespaceId}) => ({
    url: "https://api.dropboxapi.com/2/files/list_folder",
    body: {
      path,
    },
    headers: {"Content-Type": "application/json"},
    namespaceId,
    transformResult: (result) => {
      const targetFolders = result.entries.filter(
        (entry) => entry[".tag"] === "folder"
      );
      return targetFolders.map((folder) => dropboxToGenericMetadata(folder));
    },
  }),

  // POST

  postFile: ({path, file, clientModifiedAt, namespaceId}) => ({
    url: "https://content.dropboxapi.com/2/files/upload",
    namespaceId,
    headers: {
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "overwrite",
        autorename: true,
        ...(Boolean(clientModifiedAt) && {client_modified: clientModifiedAt}),
      }),
      "Content-Type": "application/octet-stream",
    },
    body: file,
    transformResult: (result) => dropboxToGenericMetadata(result),
  }),

  // DOWNLOAD

  downloadFile: ({path, namespaceId}) => ({
    url: "https://content.dropboxapi.com/2/files/download",
    namespaceId,
    responseIsBlob: true,
    headers: {
      "Dropbox-API-Arg": JSON.stringify({path}),
    },
    transformResult: (result, response) => {
      // Extract filename from Dropbox headers
      const metadataHeader = response.headers.get("dropbox-api-result");
      const metadata = metadataHeader ? JSON.parse(metadataHeader) : {};
      const fileName = metadata.name || "downloaded_file";
      // Create a File from Blob
      return new File([result], fileName, {
        type: result.type || "application/octet-stream",
      });
    },
  }),

  downloadZipFolder: ({path, namespaceId}) => ({
    url: "https://content.dropboxapi.com/2/files/download_zip",
    namespaceId,
    responseIsBlob: true,
    headers: {
      "Dropbox-API-Arg": JSON.stringify({path}),
    },
  }),
};

// SERVICES factory

const serviceFactory = (serviceProps) => {
  return async (args) => {
    try {
      const props = serviceProps(args);
      const response = await fetch(props.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          ...(props.namespaceId && {
            "Dropbox-API-Path-Root": JSON.stringify({
              ".tag": "namespace_id",
              namespace_id: props.namespaceId,
            }),
          }),
          ...(props.headers ?? {}),
        },
        body:
          props.body instanceof Blob ? props.body : JSON.stringify(props.body),
      });

      if (!response.ok) {
        throw new Error(
          `Dropbox API error: ${response.status} ${response.statusText}`
        );
      }

      let result;
      if (props.responseIsBlob) {
        result = await response.blob();
      } else {
        result = await response.json();
      }

      if (props.transformResult)
        result = props.transformResult(result, response);

      return result;
    } catch (e) {
      console.log("error", e);
    }
  };
};

// RESULT

const services = {};
Object.entries(servicesProps).forEach(([key, serviceProps]) => {
  services[key] = serviceFactory(serviceProps);
});

export default services;
