import getDropboxItemWebUrlFromMetadata from "Features/dropbox/utils/getDropboxItemWebUrlFromMetadata";

export default function getRemoteItemWebUrlFromMetadata(metadata, service) {
  if (!metadata) return null;

  if (service === "DROPBOX") {
    return getDropboxItemWebUrlFromMetadata(metadata);
  } else {
    return null;
  }
}
