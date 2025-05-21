import {Dropbox} from "dropbox";

export default function createDbx({options, accessToken}) {
  const props = {accessToken};

  // used by team folder
  if (options?.pathRoot) {
    props.pathRoot = options.pathRoot;
  }

  console.log("createDbx, props", props);
  return new Dropbox(props);
}
