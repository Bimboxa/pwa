import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedVersionId } from "../versionsSlice";

import useVersion from "../hooks/useVersion";
import useVersions from "../hooks/useVersions";
import useInitFetchProjectKrtoVersions from "../hooks/useInitFetchProjectKrtoVersions";

import { Typography, Button, Tooltip } from "@mui/material";
import { ArrowDropDown as Down, Add } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelSelectorVersion from "./PanelSelectorVersion";
import DialogCreateVersion from "./DialogCreateVersion";
import DialogDownloadVersion from "./DialogDownloadVersion";

export default function ButtonSelectorVersion() {
  const dispatch = useDispatch();

  // init

  useInitFetchProjectKrtoVersions();

  // strings

  const selectS = "Choisir une version";

  // data

  const version = useVersion();
  const versions = useVersions();

  console.log("debug_2110_versions", versions, version);

  // state

  const [open, setOpen] = useState(false);
  const [openCreateVersion, setOpenCreateVersion] = useState(false);
  const [openDownloadVersion, setOpenDownloadVersion] = useState(false);

  // helpers

  const label =
    version?.mediaMetadata?.label ?? version?.id ?? "Sélectionner une version";

  // handlers

  function handleClick() {
    dispatch(setSelectedVersionId(version?.id));
  }

  function handleClose() {
    setOpen(false);
  }

  function handleSelect(versionId) {
    dispatch(setSelectedVersionId(versionId));
    setOpen(false);
    setOpenDownloadVersion(true);
  }

  function handleCreateVersion() {
    setOpenCreateVersion(true);
    setOpen(false);
  }

  function handleCloseCreateVersion() {
    setOpenCreateVersion(false);
  }

  function handleDownloadVersion() {
    setOpenDownloadVersion(true);
    setOpen(false);
  }

  function handleCloseDownloadVersion() {
    setOpenDownloadVersion(false);
  }

  // render

  if (!versions.length > 0) {
    return (
      <>
        <ButtonGeneric
          onClick={handleCreateVersion}
          label="Créer une version"
          endIcon={<Add />}
          color="secondary"
        />
        <DialogCreateVersion
          open={openCreateVersion}
          onClose={handleCloseCreateVersion}
        />
      </>
    );
  }
  return (
    <>
      <Tooltip title={selectS}>
        <ButtonGeneric
          label={label}
          onClick={() => setOpen(true)}
          endIcon={<Down />}
        />
      </Tooltip>

      <DialogGeneric open={open} onClose={handleClose} width="350px">
        <PanelSelectorVersion
          versions={versions}
          selectedVersionId={version?.id}
          onChange={handleSelect}
          onClose={handleClose}
          onCreateClick={handleCreateVersion}
        />
      </DialogGeneric>

      <DialogCreateVersion
        open={openCreateVersion}
        onClose={handleCloseCreateVersion}
      />
      {openDownloadVersion && (
        <DialogDownloadVersion
          open={openDownloadVersion}
          onClose={handleCloseDownloadVersion}
        />
      )}
    </>
  );
}
