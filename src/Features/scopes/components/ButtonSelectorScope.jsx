import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import useSelectedScope from "../hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Typography, Menu, MenuItem } from "@mui/material";
import { ArrowDropDown as Down, Add } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SectionScopeSelectorVariantList from "Features/scopes/components/SectionScopeSelectorVariantList";
import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";
import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

export default function ButtonSelectorScope() {
  const dispatch = useDispatch();

  // data
  const appConfig = useAppConfig();
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);

  // state
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // Tant qu'un renommage est en cours, le menu ne doit pas se fermer
  // (ni au clic sur le fond, ni sur Echap) sous peine de perdre la saisie.
  const [isRenaming, setIsRenaming] = useState(false);

  // title
  const selectS = appConfig?.strings?.scope.select ?? "Sélectionner un dossier";
  const newS = appConfig?.strings?.scope.new ?? "Nouveau dossier";

  // data
  const { value: scope } = useSelectedScope();
  const scopeName = scope?.name ?? selectS;

  // handlers - menu

  const handleOpen = (event) => {
    // In viewer mode the scope selector is locked: no navigation to another scope.
    if (viewerMode) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRequestClose = () => {
    if (isRenaming) return;
    handleClose();
  };

  // handlers - creator

  function handleOpenCreator() {
    handleClose();
    dispatch(setOpenScopeCreator(true));
  }

  return (
    <>
      <ButtonGeneric
        onClick={handleOpen}
        endIcon={<Down />}
        label={scopeName}
        disabled={viewerMode}
      />

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleRequestClose}
        // Pour éviter que le menu ne se décale bizarrement lors des transitions
        transformOrigin={{ horizontal: "left", vertical: "top" }}
        anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
      >
        <SectionScopeSelectorVariantList
          onSelect={handleClose}
          onEditingChange={setIsRenaming}
        />

        {/* Bouton Nouveau Scope */}

        <MenuItem
          onClick={handleOpenCreator}
          sx={{
            gap: 1,
            color: "primary.main",
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Add fontSize="small" />
          <Typography variant="body2" fontWeight="bold">
            {newS}
          </Typography>
        </MenuItem>
      </Menu>

      <DialogAutoScopeCreator />
    </>
  );
}
