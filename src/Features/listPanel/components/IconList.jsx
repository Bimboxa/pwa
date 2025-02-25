import {Paper} from "@mui/material";

import entityPropsMap from "Features/entities/data/entityPropsMap";
import getEntityTypeFromListType from "../utils/getEntityTypeFromListType";

export default function IconList({type}) {
  const entityType = getEntityTypeFromListType(type);
  const entityProps = entityPropsMap[entityType];

  const {bgcolor, icon} = entityProps;

  return (
    <Paper
      sx={{
        borderRadius: 2,
        width: 30,
        height: 30,
        bgcolor,
        display: "flex",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </Paper>
  );
}
