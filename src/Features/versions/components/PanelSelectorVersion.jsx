import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ListItemsGenericV2 from "Features/layout/components/ListItemsGenericV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function PanelSelectorVersion({
  versions,
  selectedVersionId,
  onChange,
  onClose,
  onCreateClick,
}) {
  // helpers

  const title = "Sélectionnez une version";

  console.log("debug_2110_versions", versions);

  // helpers

  const items = versions.map((version) => ({
    id: version.id,
    label: version.mediaMetadata?.label ?? version.id,
  }));

  // handlers

  function handleClick(version) {
    onChange(version.id);
  }

  function handleCreateVersion() {
    onCreateClick();
  }

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={title} onClose={onClose} />
      <ListItemsGenericV2
        items={items}
        selectedId={selectedVersionId}
        onClick={handleClick}
        keyString="id"
        componentListItem={({ id, label }) => (
          <Box key={id} sx={{ p: 1 }}>
            <Typography variant="body2">{label}</Typography>
          </Box>
        )}
      />
      <ButtonInPanelV2
        label="Nouvelle version"
        onClick={handleCreateVersion}
        variant="outlined"
      />
    </BoxFlexVStretch>
  );
}
