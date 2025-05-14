import {useDispatch} from "react-redux";

import {setTempListings} from "../listingsConfigSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {
  Box,
  Typography,
  List,
  ListItemText,
  ListItemButton,
} from "@mui/material";
import getListingsToCreateFromAppConfig from "Features/listings/utils/getListingsToCreateFromAppConfig";

export default function SectionCreateFromPreset() {
  const dispatch = useDispatch();

  // strings

  const messageS = "Utilisez une configuration pré-paramétrée.";

  // data

  const appConfig = useAppConfig();

  // helpers

  const presets = Object.values(appConfig.presetScopesObject);

  // handlers

  function handlePresetClick(preset) {
    const listings = getListingsToCreateFromAppConfig(appConfig, preset.key);
    dispatch(setTempListings(listings));
  }

  return (
    <Box>
      <Box sx={{p: 2}}>
        <Typography variant="body2" color="text.secondary">
          {messageS}
        </Typography>
      </Box>

      <List>
        {presets.map((preset) => {
          return (
            <ListItemButton
              key={preset.key}
              divider
              onClick={() => handlePresetClick(preset)}
            >
              <ListItemText primary={preset?.name} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
