import {useState} from "react";

import useSyncFilesToPush from "../hooks/useSyncFilesToPush";
import useUploadChanges from "../hooks/useUploadChanges";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function ButtonUploadChanges() {
  // data

  const upload = useUploadChanges();
  const syncFilesToPush = useSyncFilesToPush();

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const show = syncFilesToPush?.length > 0;

  // handlers

  async function handleClick() {
    setLoading(true);
    //
    await upload();
    //
    setLoading(false);
  }

  // render

  if (show)
    return (
      <ButtonInPanel
        bgcolor="secondary.main"
        color="white"
        variant="text"
        label="Télécharger les modifications"
        loading={loading}
        onClick={handleClick}
      />
    );

  return null;
}
