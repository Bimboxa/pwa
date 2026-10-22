import PentagonIcon from "@mui/icons-material/Pentagon";

import createTemplatelessDrawCommand from "../../utils/createTemplatelessDrawCommand";

// « Dessiner — POLYGON » (templateless draft, hotkey D when last used). The
// toolbar shows a pentagon (the shape's rounded square reads as a rectangle).
export default createTemplatelessDrawCommand("POLYGON", { Icon: PentagonIcon });
