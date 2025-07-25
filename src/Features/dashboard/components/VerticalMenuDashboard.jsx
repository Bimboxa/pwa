import { useSelector, useDispatch } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import { setSelectedMenuItemKey } from "../dashboardSlice";

import {
  Folder as ProjectIcon,
  PermMedia as ScopeIcon,
} from "@mui/icons-material";
import IconScope from "Features/scopes/components/IconScope";

import VerticalMenu from "Features/layout/components/VerticalMenu";

export default function VerticalMenuDashboard() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // const

  const menuItems = [
    {
      key: "MY_SCOPES",
      label: appConfig?.strings?.scope.myScopes ?? "Mes dossiers",
      icon: <IconScope />,
    },
    {
      key: "PROJECTS",
      label: appConfig?.strings?.project.namePlural ?? "Mes projets",
      icon: <ProjectIcon />,
    },
  ];

  // data

  const selectedKey = useSelector((s) => s.dashboard.selectedMenuItemKey);

  // handlers

  function handleChange(newKey) {
    dispatch(setSelectedMenuItemKey(newKey));
  }

  return (
    <VerticalMenu
      menuItems={menuItems}
      selection={selectedKey}
      onSelectionChange={handleChange}
    />
  );
}
