export default function getItemsWithObject({
  items,
  objectsByKey,
  itemField,
  objectKey,
  variant,
}) {
  let items;

  // main
  switch (variant) {
    case "LIST": {
      items = items.map((item) => {
        const object = objectsByKey[item[itemField[objectKey]]];
        return {
          ...item,
          [itemField]: object,
        };
      });
      break;
    }
    default:
      console.log("[utils/getItemsWithObject] variant not found", variant);
      break;
  }

  return items;
}
