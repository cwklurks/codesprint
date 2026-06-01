import type { ReactElement } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { Providers } from "./providers";

export function renderWithProviders(
    ui: ReactElement,
    options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
    return render(ui, { wrapper: Providers, ...options });
}

