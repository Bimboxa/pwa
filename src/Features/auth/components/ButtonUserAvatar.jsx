import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { logout } from "../authSlice";

import { Avatar } from "@mui/material";

import MenuGeneric from "Features/layout/components/MenuGeneric";

import getAvatarStringFromUserProfile from "../utils/getAvatarStringFromUserProfile";

export default function ButtonUserAvatar() {
  const dispatch = useDispatch();

  // data

  const userProfile = useSelector((s) => s.auth.userProfile);

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
