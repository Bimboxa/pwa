import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useDeleteProjects from "Features/projects/hooks/useDeleteProjects";

export default function ButtonDeleteProjects({onDeleted}) {
  const label = "Supprimer les données de l'appareil";
  const deleteProjects = useDeleteProjects();
  return (
    <ButtonInPanel
      label={label}
      onClick={() => {
        deleteProjects();
        if (onDeleted) onDeleted();
      }}
      color="red"
      bgcolor="white"
    />
  );
}
