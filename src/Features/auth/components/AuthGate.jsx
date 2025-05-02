import {useEffect} from "react";
import {useClerk, useUser} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";

const AuthGate = ({children}) => {
  const navigate = useNavigate();

  const {user, isLoaded} = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (email) {
      localStorage.setItem("userEmail", email);
    }
  }, [email]);

  useEffect(() => {
    console.log("[EFFECT] authGate", email);
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      navigate("/sign-in"); // Redirects to Clerk sign-in page
    }
  }, []);

  return <>{children}</>;
};

export default AuthGate;
