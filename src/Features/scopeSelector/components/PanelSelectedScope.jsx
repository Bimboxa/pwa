import {Box, Button, Typography} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

import Panel from "Features/layout/components/Panel";
import ContainerProjectAndScope from "./ContainerProjectAndScope";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import CardUploadScope from "Features/sync/components/CardUploadScope";
import CardUploadChanges from "Features/sync/components/CardUploadChanges";
import CardDownloadScope from "Features/sync/components/CardDownloadScope";

export default function PanelSelectedScope({onMoreClick}) {
  // data

  const appConfig = useAppConfig();
  const {value: scope} = useSelectedScope({withProject: true});

  // strings

  const moreS = appConfig?.strings?.scope?.seeAll || "Voir toutes les missions";

  // helper

  const project = scope?.project;

  return (
    <Panel>
      <ContainerProjectAndScope project={project} scope={scope} />
      <Box sx={{width: 1, p: 1, display: "flex", justifyContent: "end"}}>
        <Button onClick={onMoreClick} endIcon={<Forward />}>
          <Typography variant="body2" color="text.secondary">
            {moreS}
          </Typography>
        </Button>
      </Box>
      {/* <CardUploadChanges /> */}
      <CardUploadScope />
      <CardDownloadScope />
    </Panel>
  );
}
