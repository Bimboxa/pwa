import {useUser} from "@clerk/clerk-react";

export default function useUserEmail() {
  const {user, isLoaded} = useUser();
  return {value: user?.primaryEmailAddress?.emailAddress, isLoading: !isLoaded};
}
