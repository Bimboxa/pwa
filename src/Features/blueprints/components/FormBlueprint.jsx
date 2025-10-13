export default function FormBlueprint({ blueprint, onChange }) {
  // data
  const template = useBlueprintFormTemplate();
  const item = { ...blueprint };

  // handlers

  function handleItemChange(item) {
    onChange(item);
  }

  return (
    <FormGenericV2
      template={template}
      item={item}
      onItemChange={handleItemChange}
    />
  );
}
