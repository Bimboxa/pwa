import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setUserEmail} from "../authSlice";

import {useClerk, useUser} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";
import useNetworkStatus from "../hooks/useNetworkStatus";

import setUserEmailInLocalStorage from "../services/setUserEmailInLocalStorage";
import getUserEmailFromLocalStorage from "../services/getUserEmailFromLocalStorage";

const AuthGate = ({children}) => {
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const dispatch = useDispatch();

  const {user, isLoaded} = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    console.log("[EFFECT] authGate", email);
    if (email) {
      setUserEmailInLocalStorage(email);
      dispatch(setUserEmail(email));
    }
    const userEmail = getUserEmailFromLocalStorage();
    if (!userEmail && isOnline) {
      navigate("/sign-in"); // Redirects to Clerk sign-in page
    }
  }, [email]);

  return <>{children}</>;
};

export default AuthGate;
