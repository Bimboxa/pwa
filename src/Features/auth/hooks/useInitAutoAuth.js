import useAutoAuth from "./useAutoAuth";
import { useEffect } from "react";

export default function useInitAutoAuth() {
    const autoAuth = useAutoAuth();

    useEffect(() => {
        autoAuth();
    }, []);
}