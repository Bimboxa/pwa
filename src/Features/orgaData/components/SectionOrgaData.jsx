import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useOrgaData from "Features/orgaData/hooks/useOrgaData";

import {List, ListItem} from "@mui/material";

import BlockOrgaData from "./BlockOrgaData";

export default function SectionOrgaData() {
  // data

  const appConfig = useAppConfig();
  const orgaDataByKey = useOrgaData({variant: "byKey"});

  // helpers

  const orgaDataItems = Object.entries(appConfig.orgaData).map(
    ([key, orgaData]) => {
      return {
        ...orgaData,
        orgaDataInDb: orgaDataByKey?.[key],
      };
    }
  );

  return (
    <List>
      {orgaDataItems.map((item) => (
        <ListItem key={item.key}>
          <BlockOrgaData orgaData={item} />
        </ListItem>
      ))}
    </List>
  );
}
