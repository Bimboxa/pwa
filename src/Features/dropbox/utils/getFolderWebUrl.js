export default function getFolderWebUrl(path) {
  const baseUrl = "https://www.dropbox.com/home";
  const webUrl = baseUrl + encodeURI(path);
  return webUrl;
}
