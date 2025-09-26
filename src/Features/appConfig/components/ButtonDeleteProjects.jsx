import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useDeleteProjects from "Features/projects/hooks/useDeleteProjects";

export default function ButtonDeleteProjects({ onDeleted }) {
  const dispatch = useDispatch();
  const label = "Supprimer les données de l'appareil";
  const deleteProjects = useDeleteProjects();

  return (
    <ButtonInPanel
      label={label}
      onClick={() => {
        dispatch(setSelectedProjectId(null));
        dispatch(setSelectedScopeId(null));
        deleteProjects();
        if (onDeleted) onDeleted();
      }}
      color="red"
      bgcolor="white"
    />
  );
}
