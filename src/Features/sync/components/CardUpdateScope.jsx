import {useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useUpdateScopeData from "../hooks/useUpdateScopeData";
import useRemoteContainer from "../hooks/useRemoteContainer";

import CardGeneric from "Features/layout/components/CardGeneric";

export default function CardUpdateScope() {
  const dispatch = useDispatch();

  // data

  const downloadData = useUpdateScopeData();
  const remoteContainer = useRemoteContainer();

  // helpers

  const title = "🔄 Mettre à jour la mission";

  const description = `Mise à jour à partir des données présentes sur ${remoteContainer?.service}`;

  const buttonLabel = "Mettre à jour";

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
