import { createPortal } from 'react-dom';

import { LASSO_MODE_CROSSING } from 'Features/mapEditorGeneric/utils/lassoMode';

// AutoCAD-like lasso styles: WINDOW (left → right) is blue with a solid
// border, CROSSING (right → left) is green with a dashed border. `rect.mode`
// is set by the lasso hooks (2D) and MainThreedEditor (3D).
const STYLE_WINDOW = {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    border: '1px solid #2196f3',
};
const STYLE_CROSSING = {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    border: '1px dashed #4caf50',
};

export default function LassoOverlay({ rect }) {
    if (!rect) return null;

    const modeStyle = rect.mode === LASSO_MODE_CROSSING ? STYLE_CROSSING : STYLE_WINDOW;

    return createPortal(
        <div style={{
            position: 'fixed',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            ...modeStyle,
            pointerEvents: 'none', // Crucial: laisse passer les événements souris
            zIndex: 99999
        }} />,
        document.body // On attache au body pour être au dessus de tout
    );
}
