import {useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useUploadScopeData from "../hooks/useUploadScopeData";
import useRemoteContainer from "../hooks/useRemoteContainer";

import CardGeneric from "Features/layout/components/CardGeneric";

export default function CardDownloadScope() {
  const dispatch = useDispatch();

  // data

  const uploadData = useUploadScopeData();
  const remoteContainer = useRemoteContainer();

  // helpers

  const title = "Réinitialiser la mission";

  const description = `La mission sera réinitialiser à partir des données présente sur ${remoteContainer.service}`;

  const buttonLabel = "Réinitialiser";

  // handlers

  async function handleClick() {
    dispatch(setOpenPanelSync(true));
    await uploadData();
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
