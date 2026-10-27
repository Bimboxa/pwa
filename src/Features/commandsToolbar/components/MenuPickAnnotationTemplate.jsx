import { Menu } from "@mui/material";

import ListPickAnnotationTemplate from "./ListPickAnnotationTemplate";

// Menu wrapping ListPickAnnotationTemplate (the list, hence its queries, only
// exists while the menu is open). `children` go above the list (options);
// `getItemSuffix(template)` is the optional right-hand text of a row.
export default function MenuPickAnnotationTemplate({
  open,
  anchorEl,
  onClose,
  filterTemplate,
  onChange,
  selectedAnnotationTemplateId = null,
  emptyText,
  getItemSuffix,
  minWidth = 240,
  children,
}) {
  return (
    <Menu
      open={Boolean(open && anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { minWidth } } }}
    >
      {children}
      {open && (
        <ListPickAnnotationTemplate
          filterTemplate={filterTemplate}
          onChange={onChange}
          selectedAnnotationTemplateId={selectedAnnotationTemplateId}
          emptyText={emptyText}
          getItemSuffix={getItemSuffix}
        />
      )}
    </Menu>
  );
}
