import { getCompletedRanges } from "../lib/code-panel";

// The previous CodePanel prefix scan, without Monaco's range conversion.
function scanPrefix(cursor: number, errors: ReadonlySet<number>): [number, number][] {
    const ranges: [number, number][] = [];
    let start = -1;
    for (let index = 0; index <= cursor; index++) {
        if (index < cursor && !errors.has(index)) {
            if (start === -1) start = index;
        } else if (start !== -1) {
            ranges.push([start, index]);
            start = -1;
        }
    }
    return ranges;
}

function measure(build: (cursor: number) => [number, number][], length: number) {
    const samples: number[] = [];
    let checksum = 0;
    for (let trial = 0; trial < 8; trial++) {
        const started = performance.now();
        for (let cursor = 1; cursor <= length; cursor++) {
            for (const [start, end] of build(cursor)) checksum += end - start;
        }
        if (trial > 0) samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    return { medianMs: samples[3], checksum };
}

for (const length of [1_000, 10_000]) {
    for (const errorCount of [0, 10]) {
        const sortedErrors = Array.from({ length: errorCount }, (_, i) => Math.floor((i + 0.5) * length / errorCount));
        const errors = new Set(sortedErrors);
        const before = measure((cursor) => scanPrefix(cursor, errors), length);
        const after = measure((cursor) => getCompletedRanges(cursor, sortedErrors), length);
        if (before.checksum !== after.checksum) throw new Error("Decoration output mismatch");
        console.log(JSON.stringify({
            length,
            errorCount,
            beforeMs: Number(before.medianMs.toFixed(3)),
            afterMs: Number(after.medianMs.toFixed(3)),
        }));
    }
}
