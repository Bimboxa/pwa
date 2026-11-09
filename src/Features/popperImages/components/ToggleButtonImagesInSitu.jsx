import { ToggleButton, Tooltip } from "@mui/material";
import PinDrop from "@mui/icons-material/PinDrop";

import useImagesDisplaySettings from "../hooks/useImagesDisplaySettings";

// ---------------------------------------------------------------------------
// ToggleButtonImagesInSitu — "in situ" toggle of the PopperImages header.
// On: the photos are drawn in the editor at their place and the panel is
// reduced to its header. Off (ex situ): the photos are the tiles of the
// panel, only their anchor stays in the editor.
// ---------------------------------------------------------------------------

export default function ToggleButtonImagesInSitu() {
  // strings

  const onS = "Photos in situ (dans l'éditeur) — cliquer pour les lister ici";
  const offS =
    "Photos ex situ (listées ici) — cliquer pour les afficher dans l'éditeur";

  // data

  const { displayMode, setDisplayMode } = useImagesDisplaySettings();
  const inSitu = displayMode === "IN_SITU";

  // handlers

  function handleChange(e) {
    e.stopPropagation();
    setDisplayMode(inSitu ? "EX_SITU" : "IN_SITU");
  }

  // render

  return (
    <Tooltip title={inSitu ? onS : offS} arrow placement="bottom">
      <ToggleButton
        value="inSitu"
        selected={inSitu}
        size="small"
        // The header is the drag handle of the popper.
        onMouseDown={(e) => e.stopPropagation()}
        onChange={handleChange}
        sx={{ p: 0.5, flexShrink: 0 }}
      >
        <PinDrop sx={{ fontSize: 16 }} />
      </ToggleButton>
    </Tooltip>
  );
}
