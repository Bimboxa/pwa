import {useSelector} from "react-redux";

export default function useMaps(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;
  const filterByMapId = options?.filterByMapId;

  // data

  const mapsMap = useSelector((s) => s.maps.mapsMap);

  // helpers

  let maps = Object.values(mapsMap);

  if (filterByProjectId) {
    maps = maps.filter((m) => m.projectId === filterByProjectId);
  }

  if (filterByMapId) {
    maps = maps.filter((m) => m.id === filterByMapId);
  }

  // return

  return maps;
}
