import useRemoteListingSyncData from "../hooks/useRemoteListingSyncData";
import useRemoteListingContainerProps from "../hooks/useRemoteListingContainerProps";

import {Box, Typography, Link} from "@mui/material";
import useRemoteServiceKey from "../hooks/useRemoteServiceKey";
import getRemoteListingContainerGenericProps from "../utils/getRemoteListingContainerGenericProps";

export default function SectionRemoteListing() {
  // strings

  const noRemoteS = "Aucun dossier connecté";

  // data

  const {value: remoteListingSyncData} = useRemoteListingSyncData();
  const {value: props, loading} = useRemoteListingContainerProps();
  const serviceKey = useRemoteServiceKey();

  // helpers

  const genericProps = getRemoteListingContainerGenericProps(props);
  const {name, webUrl, serviceName} = genericProps;

  // component - void

  const voidComponent = (
    <Box sx={{p: 1}}>
      <Typography>{noRemoteS}</Typography>
    </Box>
  );

  // component

  const component = (
    <Box sx={{p: 1}}>
      <Typography variant="body2" color="text.secondary">
        {serviceName}
      </Typography>
      <Link href={webUrl} target="_blank" rel="noopener">
        {name}
      </Link>
    </Box>
  );

  // render

  return props ? component : voidComponent;
}
