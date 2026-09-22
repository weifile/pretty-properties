// Mosaic color schemes for covers: five shades each, dark → light.
// A website can reproduce the exact same tiles with this palette + the seeded generator below.
export const COVER_MOSAICS = ["purple", "blue", "teal", "green", "orange", "pink", "gray", "sunset"] as const

export type CoverMosaic = typeof COVER_MOSAICS[number]

export const isCoverMosaic = (value: unknown): value is CoverMosaic =>
    typeof value == "string" && (COVER_MOSAICS as readonly string[]).includes(value)

export const mosaicI18nKey = (name: string) => "SCHEME_" + name.toUpperCase()

const PALETTES: Record<CoverMosaic, string[]> = {
    purple: ["#2A1A55", "#4A2D8F", "#6A46C7", "#9F70FF", "#C4A6FF"],
    blue:   ["#14224F", "#233A7A", "#3C6BD9", "#5B8DEF", "#8FB8FF"],
    teal:   ["#0F3F3C", "#1C5C5A", "#2FA79A", "#3FBFB0", "#7FE8DC"],
    green:  ["#1B4023", "#2D5A31", "#4FA85C", "#6CC070", "#A8E88C"],
    orange: ["#7A3510", "#B05A1C", "#F0923A", "#FFB347", "#FFD08A"],
    pink:   ["#6E1F4A", "#8A2F5A", "#E5679B", "#F28BB5", "#FFB6D6"],
    gray:   ["#232323", "#3A3A3A", "#6E6E6E", "#8A8A8A", "#C9C9C9"],
    sunset: ["#4A2D8F", "#9F70FF", "#F28BB5", "#FFB347", "#FFD08A"],
}

// Darker shades are picked more often so the block reads as one color with sparkle, not confetti
const WEIGHTS = [3, 3, 2, 1, 0.6]

const COLS = 16
const ROWS = 9

/** FNV-1a string hash → 32-bit seed */
const hashString = (s: string) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

/** mulberry32: tiny seeded PRNG, deterministic across platforms */
const makeRng = (seed: number) => () => {
    seed = (seed + 0x6D2B79F5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const pickShade = (rng: () => number) => {
    const total = WEIGHTS.reduce((a, b) => a + b, 0)
    let r = rng() * total
    for (let i = 0; i < WEIGHTS.length; i++) {
        r -= WEIGHTS[i]!
        if (r <= 0) return i
    }
    return WEIGHTS.length - 1
}

/**
 * Build a 16×9 mosaic as an SVG data URL. `seed` (usually the note path) makes every note's
 * pattern different but stable. Tiles are square in a 16:9 frame; other shapes crop the pattern.
 */
export const mosaicDataUrl = (scheme: CoverMosaic, seed: string) => {
    const palette = PALETTES[scheme]
    const rng = makeRng(hashString(scheme + "|" + seed))
    let rects = ""
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const color = palette[pickShade(rng)]!
            rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`
        }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS} ${ROWS}" shape-rendering="crispEdges">${rects}</svg>`
    return "url(\"data:image/svg+xml;utf8," + encodeURIComponent(svg) + "\")"
}
