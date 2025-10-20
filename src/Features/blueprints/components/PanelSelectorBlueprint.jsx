import ListItemsGenericV2 from "Features/layout/components/ListItemsGenericV2";
import { Box, Typography } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function PanelSelectorBlueprint({
  blueprints,
  selectedBlueprintId,
  onChange,
  onClose,
  onCreateClick,
}) {
  // strings

  const createS = "Nouvel export";

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title="Sélectionnez un export" onClose={onClose} />
      <ListItemsGenericV2
        divider
        items={blueprints}
        selection={selectedBlueprintId}
        onClick={(item) => onChange(item.id)}
        keyString="id"
        componentListItem={({ id, name }) => (
          <Box key={id} sx={{ p: 1 }}>
            <Typography variant="body2">{name}</Typography>
          </Box>
        )}
      />
      <ButtonInPanelV2
        label={createS}
        onClick={onCreateClick}
        variant="outlined"
      />
    </BoxFlexVStretch>
  );
}
