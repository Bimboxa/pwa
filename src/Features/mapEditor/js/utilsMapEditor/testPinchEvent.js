export default function testPinchEvent(evt) {
  const touch1 = evt.touches[0];
  const touch2 = evt.touches[1];
  return touch1 && touch2;
}
