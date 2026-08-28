import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

export default function useDataMapping() {
  // data

  const { value: project } = useSelectedProject();
  const { value: scope } = useSelectedScope();
  const baseMap = useMainBaseMap();
  const userProfile = useSelector((s) => s.auth.userProfile);

  // helpers

  const today = new Date();
  const todayS = today.toLocaleDateString("fr-FR");
  // YYMMDDHHMM timestamp (e.g. "2601020834" for 02/01/26 08:34)
  const pad2 = (n) => String(n).padStart(2, "0");
  const timestampRef =
    pad2(today.getFullYear() % 100) +
    pad2(today.getMonth() + 1) +
    pad2(today.getDate()) +
    pad2(today.getHours()) +
    pad2(today.getMinutes());

  // return

  const object = {
    projectName: project?.name,
    projectClientRef: project?.clientRef,
    scopeName: scope?.name,
    baseMapName: baseMap?.name,
    blueprintTitle:
      scope?.name && baseMap?.name ? scope?.name + " • " + baseMap?.name : null,
    todayS,
    timestampRef,
    authorName: userProfile?.userName ?? "",
  };

  const hash = Object.entries(object).reduce((ac, [key, value]) => {
    if (value) {
      ac = ac + " " + value;
    }
    return ac;
  }, "");

  return { object, hash };
}
