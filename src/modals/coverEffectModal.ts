import { TFile, Modal, Setting, App, FrontMatterCache } from "obsidian";
import PrettyPropertiesPlugin from "src/main";
import { i18n } from "src/localization/localization";
import { getNestedProperty, setNestedProperty, deleteNestedProperty } from "src/utils/propertyUtils";


/**
 * Two sliders that write cover_opacity (0–100) and cover_blur (0–20 px) to the note.
 * Default values are removed from frontmatter again so notes stay clean.
 */
export class CoverEffectModal extends Modal {
    file: TFile
    plugin: PrettyPropertiesPlugin
    opacity: number
    blur: number

    constructor(app: App, plugin: PrettyPropertiesPlugin, file: TFile) {
        super(app)
        this.plugin = plugin
        this.file = file
        this.opacity = 100
        this.blur = 0

        const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter
        if (frontmatter) {
            const o = Number(getNestedProperty(frontmatter, plugin.settings.coverOpacityProperty))
            const b = Number(getNestedProperty(frontmatter, plugin.settings.coverBlurProperty))
            if (Number.isFinite(o)) this.opacity = o
            if (Number.isFinite(b)) this.blur = b
        }
    }

    private write(prop: string, value: number, defaultValue: number) {
        void this.app.fileManager.processFrontMatter(this.file, (fm: FrontMatterCache) => {
            if (value == defaultValue) deleteNestedProperty(fm, prop)
            else setNestedProperty(fm, prop, value)
        })
    }

    onOpen() {
        const { contentEl } = this
        contentEl.createEl("h3", { text: i18n.t("ADJUST_COVER_EFFECT") })

        new Setting(contentEl)
            .setName(i18n.t("COVER_OPACITY"))
            .addSlider(slider => slider
                .setLimits(0, 100, 1)
                .setValue(this.opacity)
                .setDynamicTooltip()
                .onChange((value) => {
                    this.opacity = value
                    this.write(this.plugin.settings.coverOpacityProperty, value, 100)
                }))

        new Setting(contentEl)
            .setName(i18n.t("COVER_BLUR"))
            .addSlider(slider => slider
                .setLimits(0, 20, 1)
                .setValue(this.blur)
                .setDynamicTooltip()
                .onChange((value) => {
                    this.blur = value
                    this.write(this.plugin.settings.coverBlurProperty, value, 0)
                }))
    }

    onClose() {
        this.contentEl.empty()
    }
}
