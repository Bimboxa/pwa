import {useUser} from "@clerk/clerk-react";

export default function useUserEmail() {
  //const {user, isLoaded} = useUser();
  const userEmail = localStorage.getItem("userEmail");
  //return {value: user?.primaryEmailAddress?.emailAddress, isLoading: !isLoaded};
  return {value: userEmail};
}
