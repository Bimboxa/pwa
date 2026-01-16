import { createPortal } from 'react-dom';

export default function LassoOverlay({ rect }) {
    if (!rect) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            backgroundColor: 'rgba(33, 150, 243, 0.2)', // Bleu transparent
            border: '1px solid #2196f3',
            pointerEvents: 'none', // Crucial: laisse passer les événements souris
            zIndex: 99999
        }} />,
        document.body // On attache au body pour être au dessus de tout
    );
}