import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; zag (Chakra v3 sliders, etc.) requires a constructor.
if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}
