/**
 * Centralized CSS class name constants to prevent typos and enable IDE autocomplete.
 * These classes are used across the codebase for consistent styling.
 */

export const CSS_CLASSES = {
    // Caret styling
    CARET_ACTIVE: "cs-caret-active",
    CARET_ERROR: "cs-caret-error",
    
    // Editor focus states
    EDITOR_FOCUSED: "cs-editor-focused",
    EDITOR_BLURRED: "cs-editor-blurred",
    
    // Syntax highlighting
    SYNTAX_ERROR: "cs-syntax-error",
    SYNTAX_CORRECT: "cs-syntax-correct",
    
    // UI states
    LOADING: "cs-loading",
    DISABLED: "cs-disabled",
    HIDDEN: "cs-hidden",
} as const;

/** Type for valid CSS class names */
export type CssClass = (typeof CSS_CLASSES)[keyof typeof CSS_CLASSES];
