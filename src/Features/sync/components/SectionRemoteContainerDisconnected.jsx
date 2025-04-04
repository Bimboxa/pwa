import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {Box, Typography} from "@mui/material";
import ListRemoteContainers from "./ListRemoteContainers";
import HeaderVariantTitle from "Features/layout/components/HeaderVariantTitle";

export default function SectionRemoteContainerDisconnected({onChange}) {
  // strings

  const title = "Choisissez un service";

  // data

  const appConfig = useAppConfig();
  const remoteContainers = appConfig?.remoteContainers ?? [];

  // handlers

  function handleClick(container) {
    onChange(container);
  }
  return (
    <Box>
      <HeaderVariantTitle title={title} />
      <Box sx={{bgcolor: "white"}}>
        <ListRemoteContainers
          containers={remoteContainers}
          onClick={handleClick}
        />
      </Box>
    </Box>
  );
}
