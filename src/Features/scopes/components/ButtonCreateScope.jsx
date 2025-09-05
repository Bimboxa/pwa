import { useDispatch } from "react-redux";

import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Add } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function ButtonCreateScope() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // helpers

  //const label = appConfig?.strings.scope.create;
  const label = "Nouvelle";

  // handler

  function handleClick() {
    console.log("debug_0209 [ButtonCreateScope] handleClick");
    dispatch(setOpenScopeCreator(true));
  }

  // render

  return (
    <ButtonGeneric
      label={label}
      onClick={handleClick}
      variant="contained"
      color="secondary"
      startIcon={<Add />}
    />
  );
}
