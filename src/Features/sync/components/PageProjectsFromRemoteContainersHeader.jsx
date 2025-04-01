import useAccessTokenDropbox from "Features/dropbox/hooks/useAccessTokenDropbox";

import {Box, Typography, IconButton} from "@mui/material";
import {
  CheckCircle as Checked,
  ArrowBackIos as Back,
} from "@mui/icons-material";

import ButtonLoginDropbox from "Features/dropbox/components/ButtonLoginDropbox";

export default function PageProjectsFromRemoteContainersHeader({onBackClick}) {
  // strings

  const title = "Connexion à Dropbox";

  // data

  const accessToken = useAccessTokenDropbox();

  // handlers

  function handleBackClick() {
    onBackClick();
  }

  // helpers

  const isLogged = Boolean(accessToken);

  return (
    <Box>
      {isLogged ? (
        <Box>
          <Box
            sx={{
              p: 1,
              width: 1,
              alignItems: "center",
              //justifyContent: "space-between",
              display: "flex",
            }}
          >
            <IconButton onClick={handleBackClick}>
              <Back />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Checked sx={{color: "success.main", ml: 2}} />
          </Box>
        </Box>
      ) : (
        <ButtonLoginDropbox />
      )}
    </Box>
  );
}
