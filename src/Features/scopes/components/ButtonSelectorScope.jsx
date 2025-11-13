import { useDispatch } from "react-redux";

import { setOpenSelectorScope } from "../scopesSlice";

import useSelectedScope from "../hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Typography, Button, Tooltip } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

import DialogSelectorScope from "Features/scopes/components/DialogSelectorScope";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function ButtonSelectorScope() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // title

  const selectS = appConfig?.strings?.scope.select ?? "Sélectionner un dossier";

  // data

  const { value: scope } = useSelectedScope();

  //const projectName = scope?.project?.name;
  const scopeName = scope?.name ?? selectS;

  // handlers - dialog

  function handleClick(e) {
    dispatch(setOpenSelectorScope(true));
  }

  return (
    <>
      <Tooltip title={selectS}>
        <ButtonGeneric
          onClick={handleClick}
          endIcon={<Down />}
          label={scopeName}
        />
      </Tooltip>
      <DialogSelectorScope />
    </>
  );
}
