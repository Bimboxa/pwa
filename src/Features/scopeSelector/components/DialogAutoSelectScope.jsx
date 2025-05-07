import {useEffect, useRef, useState} from "react";
import {useSelector, useDispatch} from "react-redux";

import {setOpen} from "../scopeSelectorSlice";
import useScopes from "Features/scopes/hooks/useScopes";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useResolvedRef from "Features/misc/hooks/useResolvedRef";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ScopeSelectorV2 from "./ScopeSelectorV2";

export default function DialogAutoSelectScope() {
  const dispatch = useDispatch();
  const containerRef = useRef();

  // data

  const appConfig = useAppConfig();
  const {value: scopes} = useScopes();
  const open = useSelector((s) => s.scopeSelector.open);
  const containerEl = useResolvedRef(containerRef, open);

  // effect

  useEffect(() => {
    if (Array.isArray(scopes) && scopes.length === 0) {
      dispatch(setOpen(true));
    }
  }, [scopes?.length]);

  // helpers

  let title = appConfig?.strings?.scope?.select;
  if (!title) title = "Sélectionnez une mission";

  return (
    <DialogGeneric
      key={open ? "open" : "close"}
      ref={containerRef}
      open={open}
      onClose={() => dispatch(setOpen(false))}
      title={title}
      vh={50}
      vw={30}
    >
      {containerEl && <ScopeSelectorV2 containerEl={containerEl} />}
    </DialogGeneric>
  );
}
