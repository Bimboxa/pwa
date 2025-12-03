export default function DummySvg() {
    return (
        <svg
            width="100%"
            height="100%"
            style={{ overflow: 'hidden' }}
        >
            <rect
                x="50"
                y="50"
                width="100"
                height="100"
                fill="red"
            />
        </svg>
    );
}