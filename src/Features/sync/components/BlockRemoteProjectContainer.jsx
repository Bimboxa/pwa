import useRemoteContainer from "../hooks/useRemoteContainer";

import {Box} from "@mui/material";
import LinkRemoteItem from "./LinkRemoteItem";

export default function BlockRemoteProjectContainer({remoteProject}) {
  console.log("[remoteProjectContainer] remoteProject", remoteProject);

  // data

  const remoteContainer = useRemoteContainer();

  // helpers

  const path = remoteContainer?.projectsPath + "/" + remoteProject?.clientRef;

  return (
    <Box>
      <LinkRemoteItem path={path} label={remoteProject?.name} />
    </Box>
  );
}
