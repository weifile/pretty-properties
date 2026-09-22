import { TFile, Modal, Setting, App, FrontMatterCache } from "obsidian";
import PrettyPropertiesPlugin from "src/main";
import { i18n } from "src/localization/localization";
import { getNestedProperty, setNestedProperty, deleteNestedProperty } from "src/utils/propertyUtils";


/**
 * Cover effect: opacity slider (cover_opacity, 0–100) and mosaic slider (cover_mosaic = block size in source pixels, 0 = off).
 * Default values are removed from frontmatter again so notes stay clean.
 */
export class CoverEffectModal extends Modal {
    file: TFile
    plugin: PrettyPropertiesPlugin
    opacity: number
    mosaic: number

    constructor(app: App, plugin: PrettyPropertiesPlugin, file: TFile) {
        super(app)
        this.plugin = plugin
        this.file = file
        this.opacity = 100
        this.mosaic = 0

        const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter
        if (frontmatter) {
            const o = Number(getNestedProperty(frontmatter, plugin.settings.coverOpacityProperty))
            if (Number.isFinite(o)) this.opacity = o
            const m = Number(getNestedProperty(frontmatter, plugin.settings.coverMosaicProperty))
            if (Number.isFinite(m)) this.mosaic = m
        }
    }

    private write(prop: string, value: number, isDefault: boolean) {
        void this.app.fileManager.processFrontMatter(this.file, (fm: FrontMatterCache) => {
            if (isDefault) deleteNestedProperty(fm, prop)
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
                    this.write(this.plugin.settings.coverOpacityProperty, value, value == 100)
                }))

        new Setting(contentEl)
            .setName(i18n.t("COVER_MOSAIC"))
            .setDesc(i18n.t("COVER_MOSAIC_DESC"))
            .addSlider(slider => slider
                .setLimits(0, 200, 1)
                .setValue(this.mosaic)
                .setDynamicTooltip()
                .onChange((value) => {
                    this.mosaic = value
                    this.write(this.plugin.settings.coverMosaicProperty, value, value == 0)
                }))
    }

    onClose() {
        this.contentEl.empty()
    }
}
