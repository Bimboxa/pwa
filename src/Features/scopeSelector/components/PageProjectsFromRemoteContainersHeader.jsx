import useRemoteToken from "Features/sync/hooks/useRemoteToken";

import {Box, Typography} from "@mui/material";
import {CheckCircle as Checked} from "@mui/icons-material";

import ButtonLoginDropbox from "Features/dropbox/components/ButtonLoginDropbox";

export default function PageProjectsFromRemoteContainersHeader() {
  // strings

  const title = "Connexion à Dropbox";

  // data

  const {value: accessToken} = useRemoteToken();

  // helpers

  const isLogged = Boolean(accessToken);

  return (
    <Box>
      {isLogged ? (
        <Box
          sx={{
            p: 1,
            width: 1,
            alignItems: "center",
            //justifyContent: "space-between",
            display: "flex",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Checked sx={{color: "success.main", ml: 2}} />
        </Box>
      ) : (
        <ButtonLoginDropbox />
      )}
    </Box>
  );
}
