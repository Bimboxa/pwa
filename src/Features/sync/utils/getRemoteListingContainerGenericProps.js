import getFolderWebUrl from "Features/dropbox/utils/getFolderWebUrl";

export default function getRemoteListingContainerGenericProps(props) {
  let name = "-?-";
  let serviceName = "-?-";
  let webUrl = "-?-";

  if (props?.type === "DROPBOX_FOLDER") {
    serviceName = "Dropbox";
    name = props.dropboxFolder.name;
    webUrl = getFolderWebUrl(props.dropboxFolder.path_display);
  }

  return {name, serviceName, webUrl};
}
