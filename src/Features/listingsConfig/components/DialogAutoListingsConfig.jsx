import {useRef} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpenPanel} from "../listingsConfigSlice";

import useAutoOpenPanelListingsConfig from "../hooks/useAutoOpenPanelListingsConfig";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useResolvedRef from "Features/misc/hooks/useResolvedRef";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelListingsConfig from "./PanelListingsConfig";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function DialogAutoListingsConfig() {
  const containerRef = useRef();
  const dispatch = useDispatch();

  // strings

  const laterS = "Ajouter plus tard";

  // data

  const open = useSelector((s) => s.listingsConfig.openPanel);
  const appConfig = useAppConfig();
  const containerEl = useResolvedRef(containerRef, open);

  // effect

  useAutoOpenPanelListingsConfig();

  // helpers

  const title = appConfig?.strings?.scope?.listingsConfig || "Configuration";

  return (
    <DialogGeneric
      ref={containerRef}
      onClose={() => dispatch(setOpenPanel(false))}
      open={open}
      title={title}
      vh={50}
      vw={30}
    >
      <BoxFlexVStretch>
        <PanelListingsConfig containerEl={containerEl} />
      </BoxFlexVStretch>
      <ButtonInPanel
        onClick={() => dispatch(setOpenPanel(false))}
        label={laterS}
      />
    </DialogGeneric>
  );
}
