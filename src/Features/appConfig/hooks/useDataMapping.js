import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

export default function useDataMapping() {
  // data

  const { value: project } = useSelectedProject();
  const { value: scope } = useSelectedScope();
  const baseMap = useMainBaseMap();

  // helpers

  const today = new Date();
  const todayS = today.toLocaleDateString("fr-FR");

  // return

  const object = {
    projectName: project?.name,
    projectClientRef: project?.clientRef,
    scopeName: scope?.name,
    baseMapName: baseMap?.name,
    blueprintTitle:
      scope?.name && baseMap?.name ? scope?.name + " • " + baseMap?.name : null,
    todayS,
  };

  const hash = Object.entries(object).reduce((ac, [key, value]) => {
    if (value) {
      ac = ac + " " + value;
    }
    return ac;
  }, "");

  return { object, hash };
}
