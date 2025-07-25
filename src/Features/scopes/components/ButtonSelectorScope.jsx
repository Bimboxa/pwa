import { useDispatch } from "react-redux";

import { setOpenSelectorScope } from "../scopesSlice";

import useSelectedScope from "../hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Typography, Button, Tooltip } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

import DialogSelectorScope from "Features/scopes/components/DialogSelectorScope";

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
        <Button onClick={handleClick} endIcon={<Down />}>
          <Typography>{scopeName}</Typography>
        </Button>
      </Tooltip>
      <DialogSelectorScope />
    </>
  );
}
