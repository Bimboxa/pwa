import {useSelector} from "react-redux";

import {Box} from "@mui/material";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function SectionUpdateAppVersion() {
  // strings

  const updateS = "Installer la nouvelle version";

  // data

  const newVersionAvailable = useSelector(
    (s) => s.appConfig.newVersionAvailable
  );

  // handlers

  function handleClick() {
    window.location.reload();
  }

  return (
    <Box sx={{width: 1}}>
      <ButtonInPanel
        label={updateS}
        onClick={handleClick}
        disabled={!newVersionAvailable}
      />
    </Box>
  );
}
