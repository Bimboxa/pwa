export default function getRemoteProjectContainerGenericProps(props) {
  let name = "-?-";
  let serviceName = "-?-";

  if (props?.type === "DROPBOX_FOLDER") {
    serviceName = "Dropbox";
    name = props.dropboxFolder.name;
  }

  return {name, serviceName};
}
