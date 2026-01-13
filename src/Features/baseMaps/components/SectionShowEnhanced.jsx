import { useDispatch } from "react-redux";

import { triggerBaseMapsUpdate } from "../baseMapsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import FieldCheck from "Features/form/components/FieldCheck";

export default function SectionShowEnhanced() {
  // data

  const baseMap = useMainBaseMap();

  // data - update

  const updateEntity = useUpdateEntity();

  // handlers

  function handleChange(checked) {
    const updates = { showEnhanced: checked };
    updateEntity(baseMap.id, updates);
    dispatch(triggerBaseMapsUpdate());
  }

  // render

  return (
    <FieldCheck
      label="Afficher l'image améliorée"
      value={baseMap?.showEnhanced}
      onChange={handleChange}
    />
  );
}
