import {useState} from "react";

import {MoreHoriz as More, TableChart} from "@mui/icons-material";
import IconButtonMenu from "Features/layout/components/IconButtonMenu";
import DialogConnectToGSheet from "Features/gapi/components/DialogConnectToGSheet";

export default function IconButtonMenuMoreShapes() {
  // helpers

  const actions = [
    {
      label: "Connecter à GSheet",
      icon: <TableChart />,
      handler: () => setOpenConnectToGSheet(true),
    },
  ];

  // state

  const [openConnectToGSheet, setOpenConnectToGSheet] = useState(false);

  // handlers

  function handleCloseConnectToGSheet() {
    setOpenConnectToGSheet(false);
  }

  return (
    <>
      <IconButtonMenu icon={<More />} actions={actions} />
      {openConnectToGSheet && (
        <DialogConnectToGSheet
          open={openConnectToGSheet}
          onClose={handleCloseConnectToGSheet}
        />
      )}
    </>
  );
}
