import {useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useDownloadScopeData from "../hooks/useDownloadScopeData";
import useRemoteContainer from "../hooks/useRemoteContainer";

import CardGeneric from "Features/layout/components/CardGeneric";

export default function CardDownloadScope() {
  const dispatch = useDispatch();

  // data

  const downloadData = useDownloadScopeData();
  const remoteContainer = useRemoteContainer();

  // helpers

  const title = "Réinitialiser la mission";

  const description = `La mission sera réinitialiser à partir des données présente sur ${remoteContainer.service}`;

  const buttonLabel = "Réinitialiser";

  // handlers

  async function handleClick() {
    dispatch(setOpenPanelSync(true));
    await downloadData();
    dispatch(setOpenPanelSync(false));
  }
  return (
    <CardGeneric
      title={title}
      description={description}
      onClick={handleClick}
      actionLabel={buttonLabel}
    />
  );
}
