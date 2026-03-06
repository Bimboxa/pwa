import { useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setNewEntity } from "Features/entities/entitiesSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import useEntityFormTemplate from "Features/entities/hooks/useEntityFormTemplate";
import useNewEntity from "Features/entities/hooks/useNewEntity";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import { Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function DialogCreateEntity({
  open,
  listing,
  onClose,
  onEntityCreated,
}) {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer";
  const title = listing?.name ?? "New entity";

  // state

  const [tempItem, setTempItem] = useState({});

  // data

  const template = useEntityFormTemplate({ listing });
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const newEntity = useNewEntity();
  const createEntity = useCreateEntity();
  const containerRef = useRef(null);

  // helpers

  const item = { ...newEntity, ...tempItem };

  // handlers

  function handleItemChange(updatedItem) {
    setTempItem(updatedItem);
  }

  async function handleCreateClick() {
    const entity = await createEntity(tempItem, {
      listing,
      annotation: newAnnotation,
    });

    dispatch(setNewEntity(null));
    dispatch(setNewAnnotation(null));
    setTempItem({});

    if (onEntityCreated) onEntityCreated(entity);
  }

  function handleClose() {
    dispatch(setNewEntity(null));
    dispatch(setNewAnnotation(null));
    setTempItem({});
    if (onClose) onClose();
  }

  // render

  return (
    <DialogGeneric
      ref={containerRef}
      title={title}
      open={open}
      onClose={handleClose}
      width="400px"
      height="70vh"
    >
      <Box
        sx={{
          bgcolor: "white",
          overflow: "auto",
          flexGrow: 1,
          position: "relative",
        }}
      >
        <FormGenericV2
          template={template}
          item={item}
          onItemChange={handleItemChange}
          sectionContainerEl={containerRef.current}
        />
      </Box>
      <ButtonInPanel label={createS} onClick={handleCreateClick} />
    </DialogGeneric>
  );
}
