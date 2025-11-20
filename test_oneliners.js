// Removed require

// Mock isSkeletal since we can't easily import the TS one without compiling, 
// but we want to test the LOGIC I just wrote. 
// Actually, I can just use the logic I put in test_heuristic.js since I updated it.

function isSkeletal(content, lang) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let substantiveLines = 0;

    if (lang === 'javascript') {
        for (const line of lines) {
            if (
                !line.match(/^var .* = function\s*\(.*\)\s*{\s*$/) &&
                !line.match(/.*\.prototype\..* = function\s*\(.*\)\s*{\s*$/) &&
                !line.match(/^class /) &&
                !line.match(/^constructor/) &&
                !line.match(/^[}\]];?$/)
            ) {
                substantiveLines++;
            }
        }
    } else if (lang === 'python') {
        for (const line of lines) {
            if (
                !line.match(/^def .*:$/) &&
                !line.match(/^class /) &&
                !line.match(/^@/) &&
                !line.match(/^pass$/)
            ) {
                substantiveLines++;
            }
        }
    } else {
        return false;
    }

    return substantiveLines < 1;
}

const oneLinerJS = `var add = function(a, b) { return a + b; };`;
const oneLinerPy = `class Solution:\n    def add(self, a: int, b: int) -> int: return a + b`;
const skeletalPy = `class Solution:\n    def add(self, a: int, b: int) -> int:`;

console.log('JS One Liner Skeletal?', isSkeletal(oneLinerJS, 'javascript'));
console.log('Py One Liner Skeletal?', isSkeletal(oneLinerPy, 'python'));
console.log('Py Skeletal Skeletal?', isSkeletal(skeletalPy, 'python'));
