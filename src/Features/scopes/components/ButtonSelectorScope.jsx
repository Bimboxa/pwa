import { useState, useRef } from "react";
import { useDispatch } from "react-redux";

import { setOpenSelectorScope, setSelectedScopeId } from "../scopesSlice";

import useSelectedScope from "../hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Typography, Tooltip, Menu, MenuItem, Box } from "@mui/material";
import { ArrowDropDown as Down, Add } from "@mui/icons-material";

import DialogSelectorScope from "Features/scopes/components/DialogSelectorScope";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SectionScopeSelectorVariantList from "Features/scopes/components/SectionScopeSelectorVariantList";
import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";
import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

export default function ButtonSelectorScope() {
  const dispatch = useDispatch();

  // On utilise un timer pour gérer le délai entre la sortie du bouton et l'entrée dans le menu
  const timeoutRef = useRef(null);

  // data
  const appConfig = useAppConfig();

  // state
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // title
  const selectS = appConfig?.strings?.scope.select ?? "Sélectionner un dossier";
  const newS = appConfig?.strings?.scope.new ?? "Nouveau dossier";
  const allS = "Tout"

  // data
  const { value: scope } = useSelectedScope();
  const scopeName = scope?.name ?? selectS;

  // --- LOGIQUE D'OUVERTURE / FERMETURE ---

  const handleOpen = (event) => {
    // Si un timer de fermeture était en cours, on l'annule (car on est revenu sur le bouton ou le menu)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // On n'ouvre que si ce n'est pas déjà ouvert (évite les re-renders inutiles)
    if (!anchorEl) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    // On lance la fermeture avec un léger délai pour laisser le temps à la souris
    // de passer du bouton au menu (ou inversement) sans tout fermer.
    timeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
    }, 100); // 100ms suffisent pour gommer le "gap"
  };

  const handleCloseImmediate = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setAnchorEl(null);
  };

  // handlers - dialog
  function handleClickOpenDialog() {
    handleCloseImmediate();
    dispatch(setOpenSelectorScope(true));
  }

  function handleOpenCreator() {
    dispatch(setOpenScopeCreator(true))
  }

  function handleClickAll() {
    dispatch(setSelectedScopeId(null))
    handleCloseImmediate()
  }

  return (
    <>

      <Box
        // Le Box sert de pont pour les événements souris autour du bouton
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        sx={{ display: 'inline-block' }}
      >
        <ButtonGeneric
          // On garde le onClick pour le tactile ou si l'utilisateur clique
          onClick={handleOpen}
          endIcon={<Down />}
          label={scopeName}
        />
      </Box>


      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleCloseImmediate}
        // Désactive le focus automatique pour éviter les clignotements visuels au survol
        disableRestoreFocus
        // Cette prop empêche le menu de bloquer les événements souris autour de lui
        sx={{ pointerEvents: "none" }}

        // Configuration précise des slots internes
        slotProps={{
          paper: {
            // On réactive les événements souris UNIQUEMENT sur la zone blanche (le menu)
            sx: { pointerEvents: "auto" },
            // Si la souris est sur le menu, on annule la fermeture
            onMouseEnter: handleOpen,
            // Si la souris quitte le menu, on lance la fermeture
            onMouseLeave: handleClose,
          }
        }}
        // Pour éviter que le menu ne se décale bizarrement lors des transitions
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleClickAll} sx={{ gap: 1, color: "primary.main" }}>
          <Typography variant="body2" fontStyle="italic" color="text.secondary">
            {allS}
          </Typography>
        </MenuItem>

        <SectionScopeSelectorVariantList onSelect={handleCloseImmediate} />

        {/* Bouton Nouveau Scope */}

        <MenuItem onClick={handleOpenCreator} sx={{ gap: 1, color: "primary.main" }}>
          <Add fontSize="small" />
          <Typography variant="body2" fontWeight="bold">
            {newS}
          </Typography>
        </MenuItem>


      </Menu >

      <DialogAutoScopeCreator />
    </>
  );
}