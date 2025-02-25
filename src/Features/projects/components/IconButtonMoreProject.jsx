import {useState} from "react";

import {MoreHoriz as More} from "@mui/icons-material";

import IconButtonMenu from "Features/layout/components/IconButtonMenu";

import DialogSettings from "Features/settings/components/DialogSettings";
import DialogConnectToGapi from "Features/gapi/components/DialogConnectToGapi";
import DialogConnectBimboxToDriveFolder from "Features/gapi/components/DialogConnectBimboxToDriveFolder";

export default function IconButtonMoreProject() {
  // state

  const [openSettings, setOpenSettings] = useState(false);
  const [openGapi, setOpenGapi] = useState(false);
  const [openConnectFolder, setOpenConnectFolder] = useState(false);

  // actions

  const actions = [
    {
      label: "Configuration",
      handler: () => {
        setOpenSettings(true);
      },
    },
    {
      label: "Connexion à Google Drive",
      handler: () => {
        setOpenGapi(true);
      },
    },
    {
      label: "Connecter un dossier",
      handler: () => {
        setOpenConnectFolder(true);
      },
    },
  ];

  return (
    <>
      <IconButtonMenu icon={<More />} actions={actions} />
      <DialogSettings
        open={openSettings}
        onClose={() => setOpenSettings(false)}
      />
      {openGapi && (
        <DialogConnectToGapi
          open={openGapi}
          onClose={() => setOpenGapi(false)}
        />
      )}
      {openConnectFolder && (
        <DialogConnectBimboxToDriveFolder
          open={openConnectFolder}
          onClose={() => setOpenConnectFolder(false)}
        />
      )}
    </>
  );
}
