
const fs = require('fs');
const snippets = require('./data/leetcode-snippets.json');

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
        // Default to keeping it if we don't know the language well enough
        return false;
    }

    // If substantive lines are very few (e.g. < 1) and total lines are also small, it's skeletal.

    return substantiveLines < 1;
}

const skeletalSnippets = snippets.filter(s => isSkeletal(s.content, s.lang));
const total = snippets.length;
const skeletalCount = skeletalSnippets.length;

console.log(`Total snippets: ${total}`);
console.log(`Skeletal snippets found: ${skeletalCount}`);
console.log('Examples of skeletal snippets:');
skeletalSnippets.slice(0, 5).forEach(s => {
    console.log(`--- ${s.title} (${s.lang}) ---`);
    console.log(s.content);
});

const peekingIterator = snippets.find(s => s.title === 'Peeking Iterator');
if (peekingIterator) {
    console.log('--- Peeking Iterator Check ---');
    console.log(`Is Skeletal: ${isSkeletal(peekingIterator.content, peekingIterator.lang)}`);
    console.log(peekingIterator.content);
}
