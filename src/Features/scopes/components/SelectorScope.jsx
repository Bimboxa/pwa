import ItemsList from "Features/itemsList/components/ItemsList";
import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

export default function SelectorScope({
  scopes,
  selection,
  onSelectionChange,
}) {
  console.log("scopes", scopes);
  // helpers

  const items = scopes.map((scope) => {
    return {
      ...scope,
      primaryText: scope.name,
    };
  });

  // handlers

  function handleClick(item) {
    onSelectionChange(item.id === selection ? null : item.id);
  }

  // helpers

  const selectedIds = selection ? [selection] : [];

  return (
    <ListItemsGeneric
      items={scopes}
      selection={selectedIds}
      onClick={handleClick}
      keyString="id"
      labelKey="name"
      //disableCreation={true}
    />
  );
}
