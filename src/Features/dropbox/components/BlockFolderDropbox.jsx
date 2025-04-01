import {Box, Typography} from "@mui/material";

export default function BlockFolderDropbox({folder}) {
  // strings

  const title = "Dossier dropbox";

  // helpers

  const folderName = folder?.name;
  return (
    <Box sx={{p: 1}}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography>{folderName}</Typography>
    </Box>
  );
}
