"use client";

import { Button, Flex, Text } from "@chakra-ui/react";
import { getPillButtonStyles } from "@/lib/session-styles";

export type SegmentedOption<T extends string> = {
    value: T;
    label: string;
    /** Optional second line; forces the stacked (vertical) reading. */
    helper?: string;
};

type SegmentedControlProps<T extends string> = {
    /** Accessible name for the group; the visible heading usually repeats it. */
    label: string;
    options: ReadonlyArray<SegmentedOption<T>>;
    value: T;
    onChange: (value: T) => void;
    orientation?: "horizontal" | "vertical";
};

/**
 * One segmented control for every "pick exactly one" setting.
 *
 * The pill styling comes from `getPillButtonStyles`' framed variant (the one
 * that draws an actual pill rather than the control bar's underline tab), so
 * overlay segments and session-bar pills stay one family.
 */
export function SegmentedControl<T extends string>({
    label,
    options,
    value,
    onChange,
    orientation = "horizontal",
}: SegmentedControlProps<T>) {
    const vertical = orientation === "vertical";

    return (
        <Flex
            role="group"
            aria-label={label}
            gap={2}
            direction={vertical ? "column" : "row"}
            flexWrap={vertical ? "nowrap" : "wrap"}
        >
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <Button
                        key={option.value}
                        {...getPillButtonStyles(active, true)}
                        borderRadius="var(--radius-sm)"
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        {...(vertical
                            ? { height: "auto", py: 3, px: 4, justifyContent: "flex-start", textAlign: "start" }
                            : null)}
                    >
                        {option.helper ? (
                            <Flex direction="column" align="flex-start" gap={1}>
                                <Text fontWeight={600}>{option.label}</Text>
                                <Text fontSize="xs" color="var(--text-subtle)" letterSpacing="normal">
                                    {option.helper}
                                </Text>
                            </Flex>
                        ) : (
                            option.label
                        )}
                    </Button>
                );
            })}
        </Flex>
    );
}
