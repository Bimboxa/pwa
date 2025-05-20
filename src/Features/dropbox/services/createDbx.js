import {Dropbox} from "dropbox";

export default function createDbx({options, accessToken}) {
  const props = {accessToken};

  // used by team folder
  if (options.pathRoot) {
    props.pathRoot = pathRoot;
  }

  return new Dropbox(props);
}
