import {Box, List, ListItemButton, Button} from "@mui/material";

import FieldTextVariantMobileOverview from "./FieldTextVariantMobileOverview";
import FieldImageVariantMobileOverview from "./FieldImageVariantMobileOverview";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";

export default function FormVariantMobileOverview({
  item,
  template,
  onFieldClick,
  onSaveClick,
}) {
  // string

  const saveS = "Save";

  // handlers

  function handleFieldClick(field) {
    onFieldClick(field);
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 1,
        height: 1,
        bgcolor: "background.default",
        pb: 2,
      }}
    >
      <BoxFlexVStretch sx={{overflow: "auto"}}>
        <List>
          {template.fields.map((field) => {
            const value = item[field.key];
            const type = field.type;
            const label = field.label;
            return (
              <ListItemButton
                key={field.key}
                onClick={() => handleFieldClick(field)}
                divider
              >
                {type === "text" && (
                  <FieldTextVariantMobileOverview value={value} label={label} />
                )}
                {type === "image" && (
                  <FieldImageVariantMobileOverview
                    value={value}
                    label={label}
                  />
                )}
              </ListItemButton>
            );
          })}
        </List>
      </BoxFlexVStretch>
      <ButtonBasicMobile label={saveS} onClick={onSaveClick} />
    </Box>
  );
}
