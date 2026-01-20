/**
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Function} - The debounced function
 */
function debounce(func, delay) {
    let timerId;

    return function (...args) {
        // Capture the correct 'this' context and arguments
        const context = this;

        // Clear the existing timer if the function is called again
        // before the delay has passed
        clearTimeout(timerId);

        // Set a new timer
        timerId = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
}