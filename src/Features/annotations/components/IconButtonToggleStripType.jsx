import { Cached as CachedIcon } from "@mui/icons-material";

import ToolbarToolButton from "./ToolbarToolButton";

import useToggleAnnotationStripType from "../hooks/useToggleAnnotationStripType";

export default function IconButtonToggleStripType({ annotation, accentColor }) {
  // helpers

  const title = "Basculer ligne ↔ bande (mur)";

  // handlers

  const toggleStripType = useToggleAnnotationStripType();

  const handleClick = async () => {
    await toggleStripType(annotation);
  };

  return (
    <ToolbarToolButton
      icon={<CachedIcon fontSize="small" />}
      label={title}
      onClick={handleClick}
      accentColor={accentColor}
    />
  );
}
