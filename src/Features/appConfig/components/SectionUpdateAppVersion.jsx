import {useSelector} from "react-redux";

import {Box} from "@mui/material";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function SectionUpdateAppVersion() {
  // strings

  const updateS = "Relancer l'application";

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
        bgcolor="white"
        color="text.secondary"
        label={updateS}
        onClick={handleClick}
        //disabled={!newVersionAvailable}
      />
    </Box>
  );
}
