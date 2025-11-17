"use client";

import { useReducedMotion } from "framer-motion";
import type { MotionValue, Transition, Variants } from "framer-motion";

export const MOTION_EASE = {
    out: [0.16, 1, 0.3, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
    emphasize: [0.2, 0.8, 0.2, 1] as const,
};

export const MOTION_DURATION = {
    micro: 0.12,
    quick: 0.2,
    base: 0.3,
    slow: 0.45,
};

export const SPRING_SMOOTH: Transition = {
    type: "spring",
    stiffness: 240,
    damping: 26,
    mass: 0.9,
};

export const SPRING_SNAPPY: Transition = {
    type: "spring",
    stiffness: 360,
    damping: 32,
    mass: 0.85,
};

export const FADE_IN_UP: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
};

export const POP_IN: Variants = {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
};

export const STAGGER = {
    container: 0.06,
    item: 0.04,
};

export function animateSpring(value: MotionValue<number>, to: number, transition: Transition = SPRING_SMOOTH) {
    value.stop();
    value.set(to);
    return transition;
}

export function usePrefersReducedMotion() {
    return useReducedMotion();
}
