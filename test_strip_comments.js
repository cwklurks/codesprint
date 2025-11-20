// Removed require

// Mock stripComments logic for testing
function stripComments(content, language) {
    if (language === "python") {
        let cleaned = content.replace(/#.*$/gm, "");
        cleaned = cleaned.replace(/"""[\s\S]*?"""/g, "");
        cleaned = cleaned.replace(/'''[\s\S]*?'''/g, "");
        return cleaned;
    } else {
        let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, "");
        cleaned = cleaned.replace(/\/\/.*$/gm, "");
        return cleaned;
    }
}

const jsWithComments = `
/**
 * Block comment
 */
var add = function(a, b) {
    // Line comment
    return a + b; // Inline comment
};
`;

const pyWithComments = `
class Solution:
    """
    Docstring
    """
    def add(self, a, b):
        # Line comment
        return a + b # Inline comment
`;

console.log("--- JS Original ---");
console.log(jsWithComments);
console.log("--- JS Stripped ---");
console.log(stripComments(jsWithComments, "javascript"));

console.log("--- Py Original ---");
console.log(pyWithComments);
console.log("--- Py Stripped ---");
console.log(stripComments(pyWithComments, "python"));
