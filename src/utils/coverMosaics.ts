/**
 * Pixelate (mosaic) the cover image itself: the image is drawn onto a tiny canvas
 * `tiles` pixels wide, and the browser scales that back up with nearest-neighbour
 * sampling (image-rendering: pixelated), which gives the blocky mosaic look.
 *
 * `tiles` = number of blocks across the image width (0 = off). The original src is
 * kept in data-original-src so the effect can be undone without re-rendering.
 * External images that taint the canvas are left untouched.
 */
export const pixelateImage = (img: HTMLImageElement, tiles: number) => {
    const original = img.getAttribute("data-original-src") || img.src
    if (!original) return
    img.setAttribute("data-original-src", original)

    if (!(tiles > 0)) {
        if (img.src !== original) img.src = original
        img.classList.remove("pp-pixelated")
        return
    }

    const apply = () => {
        const src = new Image()
        src.crossOrigin = "anonymous"
        src.onload = () => {
            const w = Math.max(1, Math.round(tiles))
            const h = Math.max(1, Math.round(tiles * src.naturalHeight / src.naturalWidth))
            const canvas = document.createElement("canvas")
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext("2d")
            if (!ctx) return
            ctx.imageSmoothingEnabled = true
            ctx.drawImage(src, 0, 0, w, h)
            try {
                img.src = canvas.toDataURL("image/png")
                img.classList.add("pp-pixelated")
            } catch {
                // tainted canvas (cross-origin image): leave the image as is
            }
        }
        src.src = original
    }

    apply()
}
