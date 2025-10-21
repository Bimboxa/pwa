import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import ButtonSelectorVersion from "./ButtonSelectorVersion";
import IconButtonSaveVersion from "./IconButtonSaveVersion";
import IconButtonShareVersion from "./IconButtonShareVersion";

export default function BlockVersionInTopBar() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const versionId = useSelector((s) => s.versions.selectedVersionId);

  // render

  if (!projectId) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <ButtonSelectorVersion />
      {versionId && <IconButtonSaveVersion />}
      {versionId && <IconButtonShareVersion />}
    </Box>
  );
}
