export default function getDropboxItemWebUrlFromMetadata(metadata) {
  const baseUrl = "https://www.dropbox.com/home";
  let webUrl = baseUrl;

  if (metadata.path_display) {
    webUrl += encodeURI(metadata.path_display);
  } else if (metadata.id) {
    webUrl += encodeURI(metadata.id);
  }

  return webUrl;
}
