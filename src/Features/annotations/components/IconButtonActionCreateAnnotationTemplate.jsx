import { useState } from "react";
import { Add } from "@mui/icons-material";

import { MenuItem, Menu, Typography } from "@mui/material";

import IconButtonAction from "Features/layout/components/IconButtonAction";

import DialogCreateAnnotationTemplatesFromLibrary from "./DialogCreateAnnotationTemplatesFromLibrary";
import DialogCreateAnnotationTemplate from "./DialogCreateAnnotationTemplate";

export default function IconButtonActionCreateAnnotationTemplate() {
  // constants

  const menuItems = [
    {
      label: "Créer un modèle",
      onClick: handleOpenCreateTemplate,
    },
    {
      label: "Ajouter des modèles d'une bibliothèque",
      onClick: handleOpenLibraryTemplates,
    },
  ];
  // state

  const [anchorEl, setAnchorEl] = useState(false);
  const open = Boolean(anchorEl);

  const [openCreateTemplate, setOpenCreateTemplate] = useState(false);
  const [openLibraryTemplates, setOpenLibraryTemplates] = useState(false);

  // handlers

  function handleClick(e) {
    console.log("handleClick");
    setAnchorEl(e.currentTarget);
  }

  function handleOpenCreateTemplate() {
    setOpenCreateTemplate(true);
    setAnchorEl(false);
  }
  function handleCloseCreateTemplate() {
    setOpenCreateTemplate(false);
  }

  function handleOpenLibraryTemplates() {
    setOpenLibraryTemplates(true);
    setAnchorEl(false);
  }

  function handleCloseLibraryTemplates() {
    setOpenLibraryTemplates(false);
  }

  return (
    <>
      <IconButtonAction
        icon={Add}
        label="Créer un modèle d'annotation"
        onClick={handleClick}
      />
      {open && (
        <Menu
          open={open}
          onClose={() => setAnchorEl(false)}
          anchorEl={anchorEl}
        >
          {menuItems.map((item) => (
            <MenuItem key={item.label} onClick={item.onClick}>
              <Typography variant="body2">{item.label}</Typography>
            </MenuItem>
          ))}
        </Menu>
      )}

      {openLibraryTemplates && (
        <DialogCreateAnnotationTemplatesFromLibrary
          open={openLibraryTemplates}
          onClose={handleCloseLibraryTemplates}
        />
      )}

      {openCreateTemplate && (
        <DialogCreateAnnotationTemplate
          open={openCreateTemplate}
          onClose={handleCloseCreateTemplate}
        />
      )}
    </>
  );
}
