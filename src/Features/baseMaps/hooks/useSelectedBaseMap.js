import useBaseMap from "./useBaseMap";
import { useSelector } from "react-redux";

export default function useSelectedBaseMap() {
  const id = useSelector((s) => s.baseMaps.selectedBaseMapId);
  return useBaseMap({ id });
}
