import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import ButtonSelectorVersion from "./ButtonSelectorVersion";
import IconButtonSaveVersion from "./IconButtonSaveVersion";
import IconButtonShareVersion from "./IconButtonShareVersion";

export default function BlockVersionInTopBar() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const versionId = useSelector((s) => s.versions.selectedVersionId);
  const onboardingIsActive = useSelector(
    (s) => s.onboarding.onboardingIsActive
  );

  // helpers

  const showButtons = !onboardingIsActive && projectId;

  // render

  if (!projectId) return null;

  return (
    <Box
      sx={{
        display: showButtons ? "flex" : "none",
        alignItems: "center",
        bgcolor: "background.default",
        borderRadius: 1,
      }}
    >
      <ButtonSelectorVersion />
      {versionId && <IconButtonSaveVersion />}
      {versionId && <IconButtonShareVersion />}
    </Box>
  );
}
