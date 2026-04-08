declare module "monaco-vim" {
    import type { editor } from "monaco-editor";

    interface VimMode {
        /** Disposes the vim mode and cleans up resources */
        dispose(): void;
    }

    /**
     * Initializes Vim mode for a Monaco Editor instance.
     * @param editor - The Monaco editor instance
     * @param statusBarNode - DOM node for the status bar (optional)
     * @returns VimMode instance with dispose method
     */
    export function initVimMode(
        editor: editor.IStandaloneCodeEditor,
        statusBarNode?: HTMLElement | null
    ): VimMode;

    export type { VimMode };
}
