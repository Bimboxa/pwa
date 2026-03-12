import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { logout } from "../authSlice";

import { Avatar } from "@mui/material";

import MenuGeneric from "Features/layout/components/MenuGeneric";

import getAvatarStringFromUserProfile from "../utils/getAvatarStringFromUserProfile";
import { getUserDataService } from "../services/getUserDataService";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function ButtonUserAvatar() {
  const dispatch = useDispatch();

  // data

  const userProfile = useSelector((s) => s.auth.userProfile);
  const appConfig = useAppConfig();

  const avatarString = getAvatarStringFromUserProfile(userProfile);

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const actions = [
    {
      label: "Se déconnecter",
      handler: () => {
        dispatch(logout());
      },
    },
    {
      label: "Debug",
      handler: async () => {
        const getUserDataConfig = appConfig?.auth?.getUserData;
        const info = await getUserDataService({
          serviceUrl: getUserDataConfig?.url,
          queryParams: getUserDataConfig?.queryParams,
        });
        console.log("info", info);
      },
    },
  ];

  // return

  return (
    <>
      <Avatar
        sx={{
          bgcolor: "secondary.main",
          width: 36,
          height: 36,
          cursor: "pointer",
        }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        {avatarString}
      </Avatar>
      <MenuGeneric
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        actions={actions}
      />
    </>
  );
}
