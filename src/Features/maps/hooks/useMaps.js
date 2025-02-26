import {useSelector} from "react-redux";

export default function useMaps(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;

  // data

  const mapsMap = useSelector((s) => s.maps.mapsMap);

  // helpers

  let maps = Object.values(mapsMap);

  if (filterByProjectId) {
    maps = maps.filter((m) => m.projectId === filterByProjectId);
  }

  // return

  return maps;
}
