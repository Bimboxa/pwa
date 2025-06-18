import ListingEntities from "Features/entities/js/ListingEntities";
import getFlatItemsFromTreeItems from "Features/tree/utils/getFlatItemsFromTreeItems";
import getDatagridColumnsFromTableConfig from "../utils/getDatagridColumnsFromTableConfig";

export default class Table {
  constructor({config, listing}) {
    this.listing = listing;
    this.config = config;
    this.listingEntities = new ListingEntities({listing});
  }

  getDatagridPropsAsync = async () => {
    try {
      switch (this.config.type) {
        case "NOMENCLATURE_BASED":
          const treeItems = this.listing?.metadata?.nomenclature?.items;
          const flatItems = getFlatItemsFromTreeItems(treeItems);
          return {
            columns: getDatagridColumnsFromTableConfig(this.config),
            rows: flatItems,
            treeData: true,
            getTreeDataPath: (row) => row.path,
            defaultGroupingExpansionDepth: -1,
          };
        default:
          return {
            columns: [],
            rows: [],
          };
      }
    } catch (e) {
      console.error("error", e);
    }
  };
}
