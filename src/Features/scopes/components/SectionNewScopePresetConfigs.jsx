import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  ListItemIcon,
  Checkbox,
} from "@mui/material";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useProjectPresetScopes from "Features/projects/hooks/useProjectPresetScopes";

export default function SectionNewScopePresetConfigs({
  presetConfigKey,
  onChange,
}) {
  const appConfig = useAppConfig();

  // strings

  const descriptionS = appConfig?.strings?.presetConfig?.select;

  // data

  const presetConfigs = useProjectPresetScopes();
  console.log("[SectionNewScopePresetConfigs] presetConfigs", presetConfigs);

  // handlers

  function handleChange(presetConfigKey) {
    onChange(presetConfigKey);
  }

  return (
    <Box sx={{p: 1}}>
      <Typography variant="body2" color="text.secondary" sx={{p: 1}}>
        {descriptionS}
      </Typography>
      <List>
        {presetConfigs.map((presetConfig) => {
          const checked = presetConfig.key === presetConfigKey;
          return (
            <ListItemButton
              dense
              divider
              key={presetConfig.key}
              onClick={() => handleChange(presetConfig.key)}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={checked}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={presetConfig.name} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
