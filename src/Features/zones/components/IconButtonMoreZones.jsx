import useCreateZonesTree from "../hooks/useCreateZonesTree";

import {MoreHoriz as More} from "@mui/icons-material";
import {Icon} from "@mui/material";

import IconButtonMenu from "Features/layout/components/IconButtonMenu";

export default function IconButtonMoreZones() {
  // data

  const createZonesTree = useCreateZonesTree({createExample: true});

  const actions = [
    {
      label: "Générer un exemple",
      handler: () => createZonesTree(),
    },
  ];

  return <IconButtonMenu icon={<Icon as={More} />} actions={actions} />;
}
