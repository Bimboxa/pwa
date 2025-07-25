import ItemsList from "Features/itemsList/components/ItemsList";

export default function SelectorScope({
  scopes,
  selection,
  onSelectionChange,
}) {
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
    <ItemsList
      items={items}
      selection={selectedIds}
      onClick={handleClick}
      //disableCreation={true}
    />
  );
}
