import {useEffect, useState} from "react";

/**
 * Waits for a ref to be assigned (i.e., ref.current becomes non-null),
 * and returns it once resolved.
 *
 * Optionally, you can pass a condition (like "open") to delay resolution
 * until that condition is true.
 */
export default function useResolvedRef(ref, condition = true) {
  const [resolvedRef, setResolvedRef] = useState(null);

  useEffect(() => {
    if (!condition) {
      setResolvedRef(null);
      return;
    }

    const check = () => {
      if (ref.current) {
        setResolvedRef(ref.current);
      } else {
        requestAnimationFrame(check);
      }
    };

    check();
  }, [condition, ref]);

  return resolvedRef;
}
