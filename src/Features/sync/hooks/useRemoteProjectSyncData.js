import {useState} from "react";

export default function useRemoteProjectSyncData() {
  const [loading, setLoading] = useState(false);

  const value = null;

  return {value, loading};
}
