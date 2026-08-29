import type { ReactNode } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { chakraSystem } from "@/lib/chakra-system";

export function Providers({ children }: { children: ReactNode }) {
    return <ChakraProvider value={chakraSystem}>{children}</ChakraProvider>;
}
