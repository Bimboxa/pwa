import {useState, useEffect} from "react";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import Table from "../js/Table";

export default function useListingMainTable(options) {
  // data
  const appConfig = useAppConfig();
  const {value: selectedListing} = useSelectedListing();

  // state

  const [datagridProps, setDatagridProps] = useState({rows: [], columns: []});

  // helpers - listing
  const listing = options?.listing || selectedListing;

  // helper - tableConfig
  const config = appConfig?.tables?.[listing?.mainTableKey] || {};

  // helper - setData

  async function setDataAsync(table) {
    const data = await table.getDatagridPropsAsync();
    console.log("debug_1306 table", table, data);
    setDatagridProps(data);
  }

  // effect - set data
  useEffect(() => {
    if (listing) {
      const table = new Table({
        config,
        listing,
      });
      setDataAsync(table);
    }
  }, [listing?.id]);

  return {config, datagridProps};
}
