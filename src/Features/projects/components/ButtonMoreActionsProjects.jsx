import {useState} from "react";

import useDeleteProjects from "Features/projects/hooks/useDeleteProjects";

import {MoreVert as More} from "@mui/icons-material";

import IconButtonMenu from "Features/layout/components/IconButtonMenu";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import {setOpen} from "Features/listPanel/listPanelSlice";

export default function ButtonMoreActionsProjects() {
  // data

  const actions = [
    {
      label: "Supprimer les projets de l'appareil",
      handler: () => {
        setOpenDelete(true);
      },
    },
  ];

  // data - func

  const deleteProjects = useDeleteProjects();

  // state

  const [openDelete, setOpenDelete] = useState(false);

  // handlers

  async function handleDeleteProjects() {
    await deleteProjects();
    setOpenDelete(false);
  }

  return (
    <>
      <IconButtonMenu icon={<More />} actions={actions} />
      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={handleDeleteProjects}
      />
    </>
  );
}
