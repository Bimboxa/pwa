import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import {Box, Typography} from "@mui/material";

import LinkRemoteItem from "./LinkRemoteItem";
import ButtonLoginRemoteContainer from "./ButtonLoginRemoteContainer";
import ButtonLogoutRemoteContainer from "./ButtonLogoutRemoteContainer";
import BlockOrgaDataFolder from "Features/orgaData/components/BlockOrgaDataFolder";

export default function SectionRemoteContainerOverview() {
  // strings

  const title = "Sauvegarde distante";
  const serviceS = "Service";
  const pathS = "Dossier racine";

  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // helpers

  const serviceLabel = `${remoteContainer?.name}`;
  const pathLabel = `${pathS}:`;

  return (
    <Box sx={{p: 1}}>
      <Box
        sx={{
          p: 1,
          borderRadius: "4px",
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography sx={{mb: 1}}>{serviceLabel}</Typography>

        <Box sx={{display: "flex", alignItems: "center", p: 1}}>
          <Typography variant="body2">{pathLabel}</Typography>
          <LinkRemoteItem
            label={remoteContainer?.path}
            path={remoteContainer?.path}
          />
        </Box>
        <BlockOrgaDataFolder />
        {!accessToken ? (
          <ButtonLoginRemoteContainer remoteContainer={remoteContainer} />
        ) : (
          <ButtonLogoutRemoteContainer />
        )}
      </Box>
    </Box>
  );
}
