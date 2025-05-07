import {Avatar} from "@mui/material";
import useUserEmail from "../hooks/useUserEmail";
import getAvatarStringFromEmail from "../utils/getAvatarStringFromEmail";

export default function AuthButtonOffline() {
  // data

  const userEmail = useUserEmail();

  // helpeprs

  const avatarString = getAvatarStringFromEmail(userEmail.value);

  return (
    <Avatar sx={{bgcolor: "primary.main", width: 32, height: 32}}>
      {avatarString}
    </Avatar>
  );
}
