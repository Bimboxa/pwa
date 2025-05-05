import {Box, List, ListItemButton, Button} from "@mui/material";

import FieldTextVariantMobileOverview from "./FieldTextVariantMobileOverview";
import FieldImageVariantMobileOverview from "./FieldImageVariantMobileOverview";
import FieldCategoryVariantMobileOverview from "./FieldCategoryVariantMobileOverview";
import FieldOptionVariantMobileOverview from "./FieldOptionVariantMobileOverview";
import FieldEntityVariantMobileOverview from "./FieldEntityVariantMobileOverview";
import FieldTreeItemsVariantMobileOverview from "./FieldTreeItemsVariantMobileOverview";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";

export default function FormVariantMobileOverview({
  item,
  template,
  onFieldClick,
  onSaveClick,
}) {
  // string

  const saveS = "Enregistrer";

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
        //bgcolor: "background.default",
        //pb: 2,
      }}
    >
      <BoxFlexVStretch sx={{overflowY: "auto"}}>
        <List disablePadding>
          {template?.fields.map((field) => {
            const value = item?.[field.key];
            const type = field.type;
            const label = field.label;
            const nomenclature = field.nomenclature;
            const entities = field.entities;
            const entityModel = field.entityModel;
            const tree = field.tree;

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
                {type === "category" && (
                  <FieldCategoryVariantMobileOverview
                    value={value}
                    label={label}
                    nomenclature={nomenclature}
                  />
                )}
                {type === "entity" && (
                  <FieldEntityVariantMobileOverview
                    value={value}
                    label={label}
                    entities={entities}
                    entityModel={entityModel}
                  />
                )}
                {type === "option" && (
                  <FieldOptionVariantMobileOverview
                    value={value}
                    label={label}
                  />
                )}
                {type === "treeItems" && (
                  <FieldTreeItemsVariantMobileOverview
                    value={value}
                    label={label}
                    tree={tree}
                  />
                )}
                {/* {type === "option" && (
                  <FieldOptionVariantMobileOverview
                    value={value}
                    label={label}
                    nomenclature={nomenclature}
                  />
                )} */}
              </ListItemButton>
            );
          })}
        </List>
      </BoxFlexVStretch>
      {/* <ButtonBasicMobile label={saveS} onClick={onSaveClick} /> */}
    </Box>
  );
}
