import { MarkdownView, FrontMatterCache, Component } from "obsidian";
import PrettyPropertiesPlugin from "src/main";
import { getNestedProperty, setNestedProperty } from "../utils/propertyUtils";
import { getImageValue, renderImageFromValue } from "../utils/imageUtils";


export const renderBanner = async (
  contentEl: HTMLElement, 
  frontmatter: FrontMatterCache,
  sourcePath: string,
  component: Component,
  plugin: PrettyPropertiesPlugin) => {





    //contentEl.classList.remove("has-banner")

    let bannerVal = ""
    let bannerValInitial = getNestedProperty(frontmatter, plugin.settings.bannerProperty);

    // Fix wrong property types

    if (Array.isArray(bannerValInitial) && typeof bannerValInitial[0] == "string") {
        bannerVal = bannerValInitial[0]
    }
    
    if (bannerValInitial && typeof bannerValInitial == "string") {
        bannerVal = bannerValInitial
    }

    // Fall back to the default banner from settings when the note has none.
    // Page previews (hover popovers) never use the default, they would get noisy.
    const isPopover = contentEl.classList.contains("hover-popover")
    if (!bannerVal && plugin.settings.defaultBanner && !isPopover) {
        bannerVal = plugin.settings.defaultBanner
    }

    bannerVal = getImageValue(bannerVal)

    let positionVal = getNestedProperty(frontmatter, plugin.settings.bannerPositionProperty)
    if (!positionVal) positionVal = 50
    let positionString = positionVal.toString()

    let bannerContainerPreview = contentEl.querySelector(".markdown-reading-view > .markdown-preview-view");
    let bannerContainerSource = contentEl.querySelector(".cm-scroller");


    


    if (contentEl.classList.contains("hover-popover")) {
      bannerContainerPreview = contentEl.querySelector(".markdown-preview-view.markdown-rendered.node-insert-event");
    }
    
    let oldBannerDivSource: Element | undefined
    let oldBannerDivSources = bannerContainerSource?.querySelectorAll(".pp-banner");
    if (oldBannerDivSources) {
      oldBannerDivSources.forEach((div, i) => {
        if (i == 0) oldBannerDivSource = div
        else div.remove()
      })
    } 

    let oldBannerDivPreview: Element | undefined
    let oldBannerDivPreviews = bannerContainerPreview?.querySelectorAll(".pp-banner");
    if (oldBannerDivPreviews) {
      oldBannerDivPreviews.forEach((div, i) => {
        if (i == 0) oldBannerDivPreview = div
        else div.remove()
      })
    } 

    

    if (!plugin.settings.enableBanner) {
      oldBannerDivSource?.remove();
      oldBannerDivPreview?.remove();
      contentEl.classList.remove("has-banner")
      return
    }

    

    let bannerDiv: HTMLElement | undefined
    let bannerDivClone: HTMLElement | undefined


    let oldBannerValue = oldBannerDivSource?.getAttribute("data-value") || ""

    if (bannerVal == oldBannerValue) {
      let oldPositionValue = oldBannerDivSource?.getAttribute("data-position") || ""

      if (positionString != oldPositionValue) {
        let imageSource = oldBannerDivSource?.querySelector("img")
        let imagePreview = oldBannerDivPreview?.querySelector("img")
        let styles = {"object-position": "center " + positionString + "%"}
        imageSource?.setCssStyles(styles)
        imagePreview?.setCssStyles(styles)
        oldBannerDivSource?.setAttribute("data-position", positionString)
        oldBannerDivPreview?.setAttribute("data-position", positionString)
      }
      return
    }

  
    if (bannerVal && typeof bannerVal == "string") {

      bannerDiv = await renderImageFromValue(bannerVal, "banner", sourcePath, component, plugin)
      
      if (bannerDiv) {
        contentEl.classList.add("has-banner")
        bannerDiv.setAttribute("data-position", positionString)
        bannerDiv.setCssProps({
          "--banner-position": "center " + positionString + "%"
        })
        bannerDivClone = bannerDiv.cloneNode(true) as HTMLElement
        // cloneNode does not copy listeners, so wire both copies separately
        if (!isPopover) {
          makeBannerDraggable(bannerDiv, sourcePath, plugin)
          makeBannerDraggable(bannerDivClone, sourcePath, plugin)
        }
      }
    }

    

    if (oldBannerDivSource) {
      if (!bannerDiv) {
        oldBannerDivSource.remove();
        contentEl.classList.remove("has-banner")
      } else if (oldBannerDivSource.outerHTML != bannerDiv.outerHTML) {
          oldBannerDivSource.remove();
          bannerContainerSource?.prepend(bannerDiv);
      }
    } else if (bannerDiv) {
        bannerContainerSource?.prepend(bannerDiv);
    }

    
    if (oldBannerDivPreview) {
      if (!bannerDivClone) {
        oldBannerDivPreview.remove();
        contentEl.classList.remove("has-banner")
      } else if (oldBannerDivPreview.outerHTML != bannerDivClone.outerHTML) {
          oldBannerDivPreview.remove();
          bannerContainerPreview?.prepend(bannerDivClone);
      }
    } else if (bannerDivClone) {
        bannerContainerPreview?.prepend(bannerDivClone);
    }
}





/**
 * Drag the banner vertically to change its focal point (0–100).
 * The value is written to the banner position property on release,
 * which re-renders the banner through the normal cache-changed path.
 */
const makeBannerDraggable = (bannerDiv: HTMLElement, sourcePath: string, plugin: PrettyPropertiesPlugin) => {
  if (!plugin.settings.enableBannerDrag) return
  const img = bannerDiv.querySelector("img")
  if (!(img instanceof HTMLImageElement)) return

  bannerDiv.classList.add("pp-banner-draggable")
  img.draggable = false

  const DRAG_THRESHOLD = 3 // px — below this it is a click, not a drag

  img.addEventListener("pointerdown", (e: PointerEvent) => {
    if (e.button !== 0) return

    const startY = e.clientY
    const startPos = Number(bannerDiv.getAttribute("data-position")) || 50
    const height = img.clientHeight || 1
    let current = startPos
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      if (!moved && Math.abs(dy) < DRAG_THRESHOLD) return
      if (!moved) {
        moved = true
        bannerDiv.classList.add("pp-banner-dragging")
        img.setPointerCapture(e.pointerId)
      }
      // With object-fit: cover the image is scaled to the container width; the part that
      // does not fit vertically is the "overflow". object-position Y% hides Y% of that
      // overflow above the top edge, so moving the mouse by dy px shifts Y by dy/overflow.
      // Dragging down reveals more of the top → smaller Y.
      const renderedHeight = img.naturalWidth
        ? img.clientWidth * img.naturalHeight / img.naturalWidth
        : height * 2
      const overflow = Math.max(1, renderedHeight - height)
      current = Math.round(Math.min(100, Math.max(0, startPos - dy * 100 / overflow)))
      img.setCssStyles({ objectPosition: "center " + current + "%" })
      ev.preventDefault()
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      bannerDiv.classList.remove("pp-banner-dragging")
      if (!moved || current == startPos) return

      const file = plugin.app.vault.getFileByPath(sourcePath)
      if (!file) return
      void plugin.app.fileManager.processFrontMatter(file, (fm: FrontMatterCache) => {
        setNestedProperty(fm, plugin.settings.bannerPositionProperty, current)
      })
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  })
}





export const updateBannerForView = (
    view: MarkdownView,
    plugin: PrettyPropertiesPlugin
) => {

  let file = view.file
  if (file) {
    let cache = plugin.app.metadataCache.getFileCache(file);
    // With a default banner configured, notes without frontmatter still get one
    let frontmatter = cache?.frontmatter ?? (plugin.settings.defaultBanner ? ({} as FrontMatterCache) : undefined);
    let contentEl = view.contentEl;
    let sourcePath = view.file?.path || ""
    if (frontmatter) {
      void renderBanner(contentEl, frontmatter, sourcePath, view, plugin)
    }
  }
}




export const updateAllBanners = (plugin: PrettyPropertiesPlugin) => {
  let leaves = plugin.app.workspace.getLeavesOfType("markdown");
  for (let leaf of leaves) {
    let view = leaf.view
    if (view instanceof MarkdownView) {
        updateBannerForView(view, plugin);
    }
  }
}




  