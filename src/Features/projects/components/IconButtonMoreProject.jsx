import {useState} from "react";

import {MoreHoriz as More} from "@mui/icons-material";

import IconButtonMenu from "Features/layout/components/IconButtonMenu";

import DialogSettings from "Features/settings/components/DialogSettings";

export default function IconButtonMoreProject() {
  // state

  const [openSettings, setOpenSettings] = useState(false);

  // actions

  const actions = [
    {
      label: "Configuration",
      handler: () => {
        setOpenSettings(true);
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
    </>
  );
}
