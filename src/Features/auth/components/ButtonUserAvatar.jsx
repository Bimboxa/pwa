import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { logout } from "../authSlice";

import { Avatar } from "@mui/material";

import MenuGeneric from "Features/layout/components/MenuGeneric";

import getAvatarStringFromUserInfo from "../utils/getAvatarStringFromUserInfo";

export default function ButtonUserAvatar() {
  const dispatch = useDispatch();

  // data

  const userInfo = useSelector((s) => s.auth.userInfo);

  const avatarString = getAvatarStringFromUserInfo(userInfo);

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
  ];

  // return

  return (
    <>
      <Avatar
        sx={{
          bgcolor: "primary.main",
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
