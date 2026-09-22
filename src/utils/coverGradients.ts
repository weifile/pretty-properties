// Gradient color schemes for covers. The CSS for each lives in styles.css as .pp-gradient-<name>;
// a website can map the same names to its own gradients.
export const COVER_GRADIENTS = ["purple", "blue", "teal", "green", "orange", "pink", "gray", "sunset"] as const

export type CoverGradient = typeof COVER_GRADIENTS[number]

export const isCoverGradient = (value: unknown): value is CoverGradient =>
    typeof value == "string" && (COVER_GRADIENTS as readonly string[]).includes(value)

export const gradientI18nKey = (name: string) => "GRADIENT_" + name.toUpperCase()
