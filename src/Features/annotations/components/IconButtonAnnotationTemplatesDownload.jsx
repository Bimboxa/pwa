import { useSelector } from "react-redux";

import { Download } from "@mui/icons-material";
import IconButtonAction from "Features/layout/components/IconButtonAction";

import createKrtoFile from "Features/krtoFile/services/createKrtoFile";
import downloadBlob from "Features/files/utils/downloadBlob";

export default function IconButtonAnnotationTemplatesDownload() {
  // strings

  const label = "Télécharger les modèles";

  // data

  const listingId = useSelector((s) => s.listings.selectedListingId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // handlers

  async function handleClick() {
    const file = await createKrtoFile(projectId, {
      getAnnotationTemplatesFromListingId: listingId,
    });
    downloadBlob(file, file.name);
  }

  // render

  return (
    <IconButtonAction icon={Download} label={label} onClick={handleClick} />
  );
}
