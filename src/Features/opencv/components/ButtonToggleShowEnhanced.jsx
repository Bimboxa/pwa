import { useState } from "react";

import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

export default function ButtonToggleShowEnhanced() {
  // strings

  const label = "Afficher l'image améliorée";

  // state

  const [triggerOpenAt, setTriggerOpenAt] = useState(false);

  // data

  const baseMap = useMainBaseMap();
  const show = baseMap?.showEnhanced;

  // data - func

  const updateEntity = useUpdateEntity();

  // handlers

  function handleClick() {
    const updates = { showEnhanced: !show };
    updateEntity(baseMap.id, updates);
  }

  return (
    <ButtonActionInPanel
      variant="toggle"
      onChange={handleClick}
      label="Afficher l'image améliorée"
      triggerOpenAt={triggerOpenAt}
      checked={show}
    />
  );
}
