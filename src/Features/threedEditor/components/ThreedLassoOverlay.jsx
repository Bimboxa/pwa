import { forwardRef, useImperativeHandle, useState } from "react";

import LassoOverlay from "Features/mapEditorGeneric/components/LassoOverlay";

// Owns the lasso rectangle state in a child component so MainThreedEditor
// does not re-render on every pointermove during a lasso drag — re-renders
// would re-fire useAutoLoadAnnotationsInThreedEditor and destroy + recreate
// every annotation 3D object.

const ThreedLassoOverlay = forwardRef((_, ref) => {
  const [rect, setRect] = useState(null);

  useImperativeHandle(
    ref,
    () => ({
      setRect: (r) => setRect(r),
      clear: () => setRect(null),
    }),
    []
  );

  return <LassoOverlay rect={rect} />;
});

export default ThreedLassoOverlay;
