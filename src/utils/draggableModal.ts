import { Modal } from "obsidian";

/**
 * Make a modal movable so it can be dragged off whatever it is covering,
 * and make the backdrop see-through so live changes stay visible.
 * Drag by the header element passed in (usually the title).
 */
export const makeModalDraggable = (modal: Modal, handle: HTMLElement) => {
    const modalEl = modal.modalEl
    modalEl.classList.add("pp-draggable-modal")
    modalEl.parentElement?.classList.add("pp-see-through-modal")
    handle.classList.add("pp-modal-drag-handle")

    let dx = 0, dy = 0

    handle.addEventListener("pointerdown", (e: PointerEvent) => {
        if (e.button !== 0) return
        const startX = e.clientX - dx
        const startY = e.clientY - dy
        handle.setPointerCapture(e.pointerId)

        const onMove = (ev: PointerEvent) => {
            dx = ev.clientX - startX
            dy = ev.clientY - startY
            modalEl.setCssStyles({ transform: `translate(${dx}px, ${dy}px)` })
        }
        const onUp = () => {
            handle.removeEventListener("pointermove", onMove)
            handle.removeEventListener("pointerup", onUp)
            handle.removeEventListener("pointercancel", onUp)
        }
        handle.addEventListener("pointermove", onMove)
        handle.addEventListener("pointerup", onUp)
        handle.addEventListener("pointercancel", onUp)
        e.preventDefault()
    })
}
