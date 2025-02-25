const downloadBlob = (function () {
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style.display = "none";

  return function saveData(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
  };
})();

export default downloadBlob;
