import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";

import {Box} from "@mui/material";
import BlockFolderDropbox from "Features/dropbox/components/BlockFolderDropbox";

export default function BlockRemoteProjectContainer() {
  // data

  const {value: props} = useRemoteProjectContainerProps();
  console.log("props", props);

  // helper

  const isDropbox = props?.type === "DROPBOX_FOLDER";

  // component

  const componentByType = {
    DROPBOX_FOLDER: <BlockFolderDropbox folder={props?.dropboxFolder} />,
  };

  const component = componentByType[props?.type] || <Box />;

  return component;
}
