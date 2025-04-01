import FormGeneric from "Features/form/components/FormGeneric";

export default function FormEntity({
  template,
  entity,
  lastEntity,
  onEntityChange,
  selectorContainerRef,
}) {
  // handlers

  function handleItemChange(item) {
    onEntityChange(item);
  }

  return (
    <>
      <FormGeneric
        template={template}
        item={entity}
        lastItem={lastEntity}
        onItemChange={handleItemChange}
        selectorContainerRef={selectorContainerRef}
      />
    </>
  );
}
