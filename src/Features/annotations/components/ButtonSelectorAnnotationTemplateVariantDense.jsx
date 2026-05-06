import { useState } from "react";

import { Button, Typography, Menu, Box } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";

export default function ButtonSelectorAnnotationTemplateVariantDense({
  selectedTemplateId,
  selectedTemplate,
  displayLabel,
  onChange,
  annotationTemplates,
  listings,
  placeholder = "Sélectionner un modèle",
  bgcolor = null,
  ...props
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  function handleChange(id) {
    onChange?.(id);
    handleClose();
  }

  const resolvedTemplate =
    selectedTemplate ??
    annotationTemplates?.find((t) => t.id === selectedTemplateId);

  const label = displayLabel ?? resolvedTemplate?.label ?? placeholder;

  return (
    <>
      <Button
        endIcon={<ArrowDropDownIcon size="small" />}
        onClick={handleClick}
        sx={{ bgcolor }}
        {...props}
      >
        <Box sx={{ display: "flex", alignItems: "center", width: 1, gap: 1 }}>
          {resolvedTemplate && (
            <AnnotationTemplateIcon template={resolvedTemplate} />
          )}
          <Typography variant="body2" sx={{ ml: 1 }}>
            {label}
          </Typography>
        </Box>
      </Button>
      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <SelectorAnnotationTemplateVariantDense
          selectedAnnotationTemplateId={selectedTemplateId}
          onChange={handleChange}
          annotationTemplates={annotationTemplates}
          listings={listings}
        />
      </Menu>
    </>
  );
}
