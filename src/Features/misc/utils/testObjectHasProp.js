export default function testObjectHasProp(object, prop) {
  return object != null && Object.prototype.hasOwnProperty.call(object, prop);
}
