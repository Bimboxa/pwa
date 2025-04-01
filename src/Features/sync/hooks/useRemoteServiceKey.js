import getRemoteProjectContainerProps from "../services/getRemoteProjectContainerProps";

export default function useRemoteServiceKey() {
  const props = getRemoteProjectContainerProps();

  let service = null;

  if (props?.type === "DROPBOX_FOLDER") {
    service = "DROPBOX";
  }

  return service;
}
