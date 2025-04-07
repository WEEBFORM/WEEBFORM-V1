class StringSanitizer {
    sanitize(input) {
        // Basic sanitization - remove potential SQL characters
        return input.replace(/['";\\]/g, '');
    }
}

export default StringSanitizer;