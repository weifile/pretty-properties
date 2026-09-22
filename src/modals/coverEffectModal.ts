import { TFile, Modal, Setting, App, FrontMatterCache } from "obsidian";
import PrettyPropertiesPlugin from "src/main";
import { i18n } from "src/localization/localization";
import { getNestedProperty, setNestedProperty, deleteNestedProperty } from "src/utils/propertyUtils";
import { COVER_MOSAICS, mosaicI18nKey, isCoverMosaic } from "src/utils/coverMosaics";


/**
 * Cover effect: opacity slider (cover_opacity, 0–100) and gradient fill dropdown (cover_gradient).
 * Default values are removed from frontmatter again so notes stay clean.
 */
export class CoverEffectModal extends Modal {
    file: TFile
    plugin: PrettyPropertiesPlugin
    opacity: number
    gradient: string

    constructor(app: App, plugin: PrettyPropertiesPlugin, file: TFile) {
        super(app)
        this.plugin = plugin
        this.file = file
        this.opacity = 100
        this.gradient = ""

        const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter
        if (frontmatter) {
            const o = Number(getNestedProperty(frontmatter, plugin.settings.coverOpacityProperty))
            if (Number.isFinite(o)) this.opacity = o
            const g = getNestedProperty(frontmatter, plugin.settings.coverMosaicProperty)
            if (isCoverMosaic(g)) this.gradient = g
        }
    }

    private write(prop: string, value: number | string, isDefault: boolean) {
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
            .addDropdown(dropdown => {
                dropdown.addOption("", i18n.t("SCHEME_NONE"))
                for (const name of COVER_MOSAICS) {
                    dropdown.addOption(name, i18n.t(mosaicI18nKey(name)))
                }
                dropdown.setValue(this.gradient)
                dropdown.onChange((value) => {
                    this.gradient = value
                    this.write(this.plugin.settings.coverMosaicProperty, value, value == "")
                })
            })
    }

    onClose() {
        this.contentEl.empty()
    }
}
