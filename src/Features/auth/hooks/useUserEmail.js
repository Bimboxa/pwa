import {useSelector} from "react-redux";

export default function useUserEmail() {
  //const {user, isLoaded} = useUser();
  //const userEmail = localStorage.getItem("userEmail");
  const userEmail = useSelector((s) => s.auth.userEmail);
  //return {value: user?.primaryEmailAddress?.emailAddress, isLoading: !isLoaded};
  return {value: userEmail};
}
