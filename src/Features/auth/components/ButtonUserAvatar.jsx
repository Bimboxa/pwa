import { Avatar } from "@mui/material";

export default function ButtonUserAvatar() {
  // data

  const userInfo = useSelector((s) => s.auth.userInfo);

  // return

  return;
  <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}>
    {avatarString}
  </Avatar>;
}
