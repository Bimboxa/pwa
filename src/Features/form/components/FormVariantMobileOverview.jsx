import {List, ListItemButton} from "@mui/material";
import FieldTextVariantMobileOverview from "./FieldTextVariantMobileOverview";

export default function FormVariantMobileOverview({
  item,
  template,
  onFieldClick,
}) {
  // handlers

  function handleFieldClick(field) {
    onFieldClick(field);
  }

  return (
    <List>
      {template.fields.map((field) => {
        const value = item[field.key];
        const type = field.type;
        const label = field.label;
        return (
          <ListItemButton
            key={field.key}
            onClick={() => handleFieldClick(field)}
          >
            {type === "text" && (
              <FieldTextVariantMobileOverview value={value} label={label} />
            )}
          </ListItemButton>
        );
      })}
    </List>
  );
}
