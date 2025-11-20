export type Shortcut = {
    combo: string;
    detail: string;
};

export const KEYBOARD_SHORTCUTS: Shortcut[] = [
    { combo: "R", detail: "Reset the session and start a fresh run" },
    { combo: "N or Q", detail: "Jump to the next problem when paused or finished" },
    { combo: "L", detail: "Show or hide the live stats panel" },
    { combo: "P", detail: "Open preferences" },
    { combo: "Esc", detail: "Abort the current run" },
];

