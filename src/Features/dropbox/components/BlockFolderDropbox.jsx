import {useState} from "react";

import {Box, Typography} from "@mui/material";

import DialogCreateRemoteProjectContainer from "Features/sync/components/DialogCreateRemoteProjectContainer";

export default function BlockFolderDropbox({label, metadata}) {
  // strings

  const title = "Dossier dropbox";

  // state

  const [open, setOpen] = useState(false);

  // helpers

  //const folderName = metadata?.name;
  return (
    <>
      <Box sx={{p: 1}}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography>{label}</Typography>
      </Box>

      <DialogCreateRemoteProjectContainer
        open={open}
        onClose={() => setOpen(false)}
        remoteProject={remoteProject}
        remoteContainer={remoteContainer}
      />
    </>
  );
}
