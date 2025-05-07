import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useDeleteProjects from "Features/projects/hooks/useDeleteProjects";

export default function ButtonDeleteProjects() {
  const label = "Supprimer les données de l'appareil";
  const deleteProjects = useDeleteProjects();
  return (
    <ButtonInPanel
      label={label}
      onClick={deleteProjects}
      color="red"
      bgcolor="white"
    />
  );
}
