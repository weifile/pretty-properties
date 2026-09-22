import {
	MarkdownView,
	FrontMatterCache,
	Component, 
	MarkdownPreviewView,
	TFile
} from "obsidian";
import PrettyPropertiesPlugin from "src/main";
import { getNestedProperty, setNestedProperty } from "../utils/propertyUtils";
import { CanvasView, EmbedMarkdownComponent, WidgetEditorView } from "@obsidian-typings/obsidian-public-latest";
import { getImageValue, renderImageFromValue } from "../utils/imageUtils";
import { getFormattedString } from "src/utils/formatUtils";
import { COVER_GRADIENTS, CoverGradient, isCoverGradient } from "src/utils/coverGradients";




interface EmbedMarkdownComponentExtended extends EmbedMarkdownComponent {
    containerEl: HTMLElement,
    previewMode: MarkdownPreviewView,
	file: TFile
}



export const renderCover = async (
	component: Component,
	contentEl: HTMLElement,
	frontmatter: FrontMatterCache,
	sourcePath: string,
	plugin: PrettyPropertiesPlugin
) => {



	const mdContainer = contentEl.querySelector(".metadata-container");



	if (!(mdContainer?.instanceOf(HTMLElement))) return;

	let oldCoverDiv: Element | undefined
	let oldCoverDivs = mdContainer.querySelectorAll(".pp-cover");

	if (oldCoverDivs) {
      oldCoverDivs.forEach((div, i) => {
        if (i == 0) oldCoverDiv = div
        else div.remove()
      })
    } 


	if (!plugin.settings.enableCover) {
		oldCoverDiv?.remove();
		mdContainer.classList.remove("has-cover")
		return
	}

	let coverDiv: HTMLElement | undefined;
	let coverVal = ""

	for (let entry of plugin.settings.coverProperties) {
		let propertyValue = getNestedProperty(frontmatter, entry.property)
		if (propertyValue) {
			if (Array.isArray(propertyValue)) {
				propertyValue = propertyValue[0]
			}
			if (!propertyValue) continue
			coverVal = propertyValue.toString()

			const formatString = entry.format;
			if (formatString) {
				coverVal = getFormattedString(entry.property, coverVal, formatString)
			}
			break
		}
	}

	// Fall back to the default cover from settings when the note has none
	if (!coverVal && plugin.settings.defaultCover) {
		coverVal = plugin.settings.defaultCover
	}

	coverVal = getImageValue(coverVal)

	if (coverVal) {
		coverDiv = await renderImageFromValue(coverVal, "cover", sourcePath, component, plugin)
	} else if (readCoverGradient(frontmatter, plugin)) {
		// No image at all: a gradient block stands in as the cover
		coverDiv = createGradientCover()
	}

	if (coverDiv) {
		applyCoverCssClasses(frontmatter, coverDiv, mdContainer, contentEl, plugin);
		applyCoverCrop(frontmatter, coverDiv, plugin);
		if (!contentEl.classList.contains("hover-popover")) {
			makeCoverAdjustable(coverDiv, sourcePath, plugin);
		}


		/* Remove all old covers again, because sometimes we get extra ones when the view is opened more then once */

		oldCoverDivs = mdContainer.querySelectorAll(".pp-cover");

		if (oldCoverDivs) {
			oldCoverDivs.forEach((div, i) => {
				if (i == 0) oldCoverDiv = div
				else div.remove()
			})
		} 

		if (oldCoverDiv) {
			if (coverDiv.outerHTML != oldCoverDiv.outerHTML) {
				oldCoverDiv.remove();
				mdContainer.prepend(coverDiv);
			}
		} else {
			mdContainer.prepend(coverDiv);
		}
	} else {
		if (oldCoverDiv) oldCoverDiv.remove();
	}
};






const  applyCoverCssClasses = (
	frontmatter: FrontMatterCache,
	coverDiv: HTMLElement,
	mdContainer: HTMLElement,
	contentEl: HTMLElement,
	plugin: PrettyPropertiesPlugin
) => {

	mdContainer.classList.add("has-cover")
	coverDiv.classList.add("pp-cover");


	if (contentEl.classList.contains("canvas-node-content")) {
		mdContainer.classList.add("in-canvas")
	} else if (contentEl.classList.contains("hover-popover")) {
		mdContainer.classList.add("in-popover")
	}

	let positionClasses = [
		"left", 
		"right", 
		"top", 
		"bottom"
	]

	let shapeClasses = [
		"initial",
		"initial-2",
		"initial-3",
		"vertical-cover",
		"vertical-contain",
		"horizontal-cover",
		"horizontal-contain",
		"wide-cover",
		"wide-contain",
		"square",
		"circle"
	]

	for (let cls of positionClasses) {
		mdContainer.classList.remove(cls)
	}

	for (let cls of shapeClasses) {
		mdContainer.classList.remove(cls)
	}

	let coverShapeVal = getNestedProperty(frontmatter, plugin.settings.coverShapeProperty)
	
	if (coverShapeVal && typeof coverShapeVal == "string" && shapeClasses.find(c => c == coverShapeVal)) {
		coverDiv.classList.add(coverShapeVal);
		mdContainer.classList.add(coverShapeVal);
	}
		
	else {
		coverDiv.classList.add("initial");
		mdContainer.classList.add("initial");
	}

	let coverPositionVal = getNestedProperty(frontmatter, plugin.settings.coverPositionProperty)

	if (coverPositionVal && typeof coverPositionVal == "string" && positionClasses.find(c => c == coverPositionVal)) {
		coverDiv.classList.add(coverPositionVal);
		mdContainer.classList.add(coverPositionVal);
	}
		
	else {
		coverDiv.classList.add(plugin.settings.coverPosition)
		mdContainer.classList.add(plugin.settings.coverPosition)
	}
}












/* ---------- Cover crop: pan (cover_x / cover_y, 0–100) and zoom (cover_zoom, 1–4) ---------- */

interface CoverCrop { x: number; y: number; z: number }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const readNumber = (frontmatter: FrontMatterCache, prop: string, fallback: number) => {
	const v = getNestedProperty(frontmatter, prop)
	const n = typeof v == "number" ? v : Number(v)
	return Number.isFinite(n) ? n : fallback
}

const readCoverCrop = (frontmatter: FrontMatterCache, plugin: PrettyPropertiesPlugin): CoverCrop => ({
	x: clamp(readNumber(frontmatter, plugin.settings.coverXProperty, 50), 0, 100),
	y: clamp(readNumber(frontmatter, plugin.settings.coverYProperty, 50), 0, 100),
	z: clamp(readNumber(frontmatter, plugin.settings.coverZoomProperty, 1), 1, 4),
})

/**
 * The crop is expressed as plain CSS so a website can reproduce it with the same three numbers:
 *   object-fit: cover; object-position: X% Y%; transform: scale(Z); transform-origin: X% Y%;
 * inside a clipping frame (overflow: hidden).
 */
const applyCropStyles = (img: HTMLElement, crop: CoverCrop) => {
	img.setCssStyles({
		objectPosition: crop.x + "% " + crop.y + "%",
		transform: crop.z > 1 ? "scale(" + crop.z + ")" : "",
		transformOrigin: crop.x + "% " + crop.y + "%",
	})
}

/** Gradient scheme for this note: its own property, else the default from settings, else none */
const readCoverGradient = (frontmatter: FrontMatterCache, plugin: PrettyPropertiesPlugin): CoverGradient | undefined => {
	const own = getNestedProperty(frontmatter, plugin.settings.coverGradientProperty)
	if (isCoverGradient(own)) return own
	const def = plugin.settings.defaultCoverGradient
	return isCoverGradient(def) ? def : undefined
}

/** A cover made of nothing but a gradient block (same structure as an image cover, minus the img) */
const createGradientCover = () => {
	const coverDiv = createDiv({ cls: ["pp-cover", "mode-gradient"] })
	const frame = createDiv({ cls: "pp-cover-frame" })
	frame.appendChild(createDiv({ cls: ["pp-cover-image", "pp-cover-gradient"] }))
	coverDiv.appendChild(frame)
	coverDiv.setAttribute("data-value", "")
	return coverDiv
}

const applyCoverCrop = (frontmatter: FrontMatterCache, coverDiv: HTMLElement, plugin: PrettyPropertiesPlugin) => {
	const frame = coverDiv.querySelector(".pp-cover-frame")
	if (!(frame instanceof HTMLElement)) return

	// Gradient fill: painted on the frame, behind the image. Visible when the image is
	// translucent, or as the whole cover when there is no image.
	for (const name of COVER_GRADIENTS) frame.classList.remove("pp-gradient-" + name)
	const gradient = readCoverGradient(frontmatter, plugin)
	if (gradient) frame.classList.add("pp-gradient-" + gradient)

	const img = frame.querySelector("img")
	if (!(img instanceof HTMLImageElement)) return
	const crop = readCoverCrop(frontmatter, plugin)
	coverDiv.setAttribute("data-crop", crop.x + "," + crop.y + "," + crop.z)
	applyCropStyles(img, crop)

	// Per-note opacity (0–100) on the image itself, so the gradient underneath shows through
	const opacity = clamp(readNumber(frontmatter, plugin.settings.coverOpacityProperty, 100), 0, 100)
	img.setCssStyles({ opacity: opacity < 100 ? String(opacity / 100) : "" })
}

const cropFromAttr = (coverDiv: HTMLElement): CoverCrop => {
	const parts = (coverDiv.getAttribute("data-crop") || "").split(",").map(Number)
	return {
		x: Number.isFinite(parts[0]) ? parts[0]! : 50,
		y: Number.isFinite(parts[1]) ? parts[1]! : 50,
		z: Number.isFinite(parts[2]) ? parts[2]! : 1,
	}
}

/**
 * Drag to pan, Ctrl/Cmd + wheel to zoom. Values are written to the note's frontmatter,
 * which re-renders the cover through the normal cache-changed path.
 */
const makeCoverAdjustable = (coverDiv: HTMLElement, sourcePath: string, plugin: PrettyPropertiesPlugin) => {
	if (!plugin.settings.enableCoverDrag) return
	const frame = coverDiv.querySelector(".pp-cover-frame")
	const img = frame?.querySelector("img")
	if (!(frame instanceof HTMLElement) || !(img instanceof HTMLImageElement)) return
	if (coverDiv.classList.contains("pp-cover-adjustable")) return

	coverDiv.classList.add("pp-cover-adjustable")
	img.draggable = false

	const DRAG_THRESHOLD = 3
	const ZOOM_STEP = 1.1

	const writeCrop = (crop: CoverCrop) => {
		const file = plugin.app.vault.getFileByPath(sourcePath)
		if (!file) return
		void plugin.app.fileManager.processFrontMatter(file, (fm: FrontMatterCache) => {
			setNestedProperty(fm, plugin.settings.coverXProperty, Math.round(crop.x))
			setNestedProperty(fm, plugin.settings.coverYProperty, Math.round(crop.y))
			setNestedProperty(fm, plugin.settings.coverZoomProperty, Math.round(crop.z * 100) / 100)
		})
	}

	// How many px of image lie outside the frame on each axis, given object-fit: cover and the zoom
	const overflowPx = (z: number) => {
		const fw = frame.clientWidth || 1
		const fh = frame.clientHeight || 1
		const natW = img.naturalWidth || fw
		const natH = img.naturalHeight || fh
		const scale = Math.max(fw / natW, fh / natH) * z
		return {
			x: Math.max(1, natW * scale - fw),
			y: Math.max(1, natH * scale - fh),
		}
	}

	img.addEventListener("pointerdown", (e: PointerEvent) => {
		if (e.button !== 0) return
		const start = cropFromAttr(coverDiv)
		const startX = e.clientX
		const startY = e.clientY
		let current: CoverCrop = { ...start }
		let moved = false

		const onMove = (ev: PointerEvent) => {
			const dx = ev.clientX - startX
			const dy = ev.clientY - startY
			if (!moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
			if (!moved) {
				moved = true
				coverDiv.classList.add("pp-cover-dragging")
				img.setPointerCapture(e.pointerId)
			}
			const ov = overflowPx(start.z)
			// Dragging right reveals more of the left side → smaller X; same for Y
			current = {
				x: clamp(start.x - dx * 100 / ov.x, 0, 100),
				y: clamp(start.y - dy * 100 / ov.y, 0, 100),
				z: start.z,
			}
			applyCropStyles(img, current)
			ev.preventDefault()
		}

		const onUp = () => {
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerup", onUp)
			window.removeEventListener("pointercancel", onUp)
			coverDiv.classList.remove("pp-cover-dragging")
			if (!moved) return
			coverDiv.setAttribute("data-crop", current.x + "," + current.y + "," + current.z)
			writeCrop(current)
		}

		window.addEventListener("pointermove", onMove)
		window.addEventListener("pointerup", onUp)
		window.addEventListener("pointercancel", onUp)
	})

	let wheelTimer: number | undefined
	img.addEventListener("wheel", (e: WheelEvent) => {
		if (!(e.ctrlKey || e.metaKey)) return
		e.preventDefault()
		e.stopPropagation()
		const crop = cropFromAttr(coverDiv)
		const z = clamp(e.deltaY < 0 ? crop.z * ZOOM_STEP : crop.z / ZOOM_STEP, 1, 4)
		const next: CoverCrop = { x: crop.x, y: crop.y, z: Math.round(z * 100) / 100 }
		coverDiv.setAttribute("data-crop", next.x + "," + next.y + "," + next.z)
		applyCropStyles(img, next)
		if (wheelTimer) window.clearTimeout(wheelTimer)
		wheelTimer = window.setTimeout(() => writeCrop(next), 400)
	}, { passive: false })
}





export const updateCoverForView = (
    view: MarkdownView | WidgetEditorView | EmbedMarkdownComponentExtended,
    plugin: PrettyPropertiesPlugin
) => {



  let file = view.file
  if (file) {
    let cache = plugin.app.metadataCache.getFileCache(file);
    // With a default cover image or gradient configured, notes without frontmatter still get one
    const hasDefault = !!(plugin.settings.defaultCover || plugin.settings.defaultCoverGradient)
    let frontmatter = cache?.frontmatter ?? (hasDefault ? ({} as FrontMatterCache) : undefined);
    let contentEl = view.containerEl;
    let sourcePath = view.file?.path || ""
    if (frontmatter) {
      void renderCover(view, contentEl, frontmatter, sourcePath, plugin)

	  if ("editMode" in view && view.editMode) {
        void renderCover(view.editMode, view.editMode.containerEl, frontmatter, sourcePath, plugin);
      }
    }
  }

}



export const updateAllCovers = (plugin: PrettyPropertiesPlugin) => {

	let mdLeaves = plugin.app.workspace.getLeavesOfType("markdown");
		for (let leaf of mdLeaves) {
		let view = leaf.view
		if (view instanceof MarkdownView) {
			updateCoverForView(view, plugin);
		} 
	}


	let canvasLeaves = plugin.app.workspace.getLeavesOfType("canvas");
	for (let leaf of canvasLeaves) {
		let view = leaf.view as CanvasView

		view.canvas?.nodes?.forEach(node => {
			let nodeView = node.child
			
			if (nodeView) {
				updateCoverForView(nodeView, plugin);
			}
		})
	}



}










