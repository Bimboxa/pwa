export default function getDatagridColumnsFromTableConfig(tableConfig) {
  switch (tableConfig.type) {
    case "ENTITIES_BASED": {
      if (!tableConfig?.columns) return [];

      return tableConfig.columns.map((column) => {
        return {
          field: column.key,
          headerName: column.label,
          //width: column.width,
          //sortable: column.sortable,
          //filterable: column.filterable,
          //renderCell: column.renderCell,
          // Add any other properties you need to map
        };
      });
    }
    case "NOMENCLATURE_BASED": {
      if (!tableConfig.categoryKeyLabel) return [];
      const columns = tableConfig.categoryKeyLabel.map(({key, label}) => ({
        field: key,
        headerName: label,
      }));
      columns.push();
      return [
        {field: "__tree_data_group__", headerName: "Catégorie", flex: 1},
        ...columns,
      ];
    }
  }
}
