import {useDispatch} from "react-redux";

import {
  setSelectedRemoteProjectsContainer,
  setOpenPanelSync,
} from "../syncSlice";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import setRemoteProjectContainerProps from "../services/setRemoteProjectContainerProps";

export default function SectionDisconnectRemoteProjectContainer() {
  const dispatch = useDispatch();

  const label = "Se déconnecter";

  function handleClick() {
    setRemoteProjectContainerProps(null);
    dispatch(setSelectedRemoteProjectsContainer(null));
    dispatch(setOpenPanelSync(false));
  }

  return <ButtonInPanel label={label} onClick={handleClick} />;
}
