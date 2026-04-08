"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box, Text } from "@chakra-ui/react";

type ToastType = "info" | "success" | "error";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastState {
    toasts: Toast[];
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

const notifyListeners = () => {
    toastListeners.forEach((listener) => listener([...toasts]));
};

export const toast = {
    info: (message: string) => {
        const id = Math.random().toString(36).slice(2);
        toasts = [...toasts, { id, message, type: "info" }];
        notifyListeners();
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            notifyListeners();
        }, 3000);
    },
    success: (message: string) => {
        const id = Math.random().toString(36).slice(2);
        toasts = [...toasts, { id, message, type: "success" }];
        notifyListeners();
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            notifyListeners();
        }, 3000);
    },
    error: (message: string) => {
        const id = Math.random().toString(36).slice(2);
        toasts = [...toasts, { id, message, type: "error" }];
        notifyListeners();
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            notifyListeners();
        }, 4000);
    },
};

export function useToast() {
    const [state, setState] = useState<ToastState>({ toasts: [] });

    useEffect(() => {
        const listener = (newToasts: Toast[]) => {
            setState({ toasts: newToasts });
        };
        toastListeners.push(listener);
        listener([...toasts]);
        return () => {
            toastListeners = toastListeners.filter((l) => l !== listener);
        };
    }, []);

    return state;
}

const bgColors: Record<ToastType, string> = {
    info: "blue.500",
    success: "green.500",
    error: "red.500",
};

export function ToastContainer() {
    const { toasts } = useToast();

    return (
        <Box
            position="fixed"
            top="20px"
            right="20px"
            zIndex="toast"
            display="flex"
            flexDirection="column"
            gap="2"
            aria-live="polite"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                        <Box
                            bg={bgColors[t.type]}
                            color="white"
                            px="4"
                            py="3"
                            borderRadius="md"
                            boxShadow="lg"
                            minW="200px"
                        >
                            <Text fontSize="sm" fontWeight="medium">
                                {t.message}
                            </Text>
                        </Box>
                    </motion.div>
                ))}
            </AnimatePresence>
        </Box>
    );
}
