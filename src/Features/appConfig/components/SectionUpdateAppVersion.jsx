import {useSelector} from "react-redux";

import {Box} from "@mui/material";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import setHideWarningInLocalStorage from "Features/sync/services/setHideWarningInLocalStorage";

export default function SectionUpdateAppVersion() {
  // strings

  const updateS = "Mettre à jour l'application";

  // data

  const newVersionAvailable = useSelector(
    (s) => s.appConfig.newVersionAvailable
  );

  // handlers

  function handleClick() {
    try {
      setHideWarningInLocalStorage(false);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            for (const registration of registrations) {
              registration.unregister();
            }
          })
          .finally(() => {
            window.location.reload(); // force reload
          });
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.log("error", e);
    }
  }

  return (
    <Box sx={{width: 1}}>
      <ButtonInPanel
        bgcolor="white"
        color="text.secondary"
        label={updateS}
        onClick={handleClick}
        //disabled={!newVersionAvailable}
      />
    </Box>
  );
}
