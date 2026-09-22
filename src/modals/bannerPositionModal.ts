import { TFile, Modal, Setting, App, FrontMatterCache } from "obsidian";
import PrettyPropertiesPlugin from "src/main";
import { getNestedProperty, setNestedProperty } from "src/utils/propertyUtils";
import { makeModalDraggable } from "src/utils/draggableModal";
import { i18n } from "src/localization/localization";


export class BannerPositionModal extends Modal {
    file: TFile
    position: number
    bannerPositionProperty: string

    constructor(app: App, plugin: PrettyPropertiesPlugin, file: TFile, bannerPositionProperty: string) {
        super(app)
        let cache = plugin.app.metadataCache.getFileCache(file);
        let frontmatter = cache?.frontmatter
        this.position = 50
        if (frontmatter) {
            let positionVal = getNestedProperty(frontmatter, bannerPositionProperty)
            if (typeof positionVal == "number") {
                this.position = positionVal
            }
        }
        
        this.file = file
        this.bannerPositionProperty = bannerPositionProperty
    }

    onOpen() {
        const {contentEl} = this
        const title = contentEl.createEl("h3", { text: i18n.t("SELECT_BANNER_POSITION") })
        makeModalDraggable(this, title)
        let positionSetting = new Setting(contentEl)
        .addSlider(slider => slider
            .setLimits(0, 100, 1)
            .setValue(this.position)
            .setDynamicTooltip()
            .onChange((value) => {
                void this.app.fileManager.processFrontMatter(this.file, (fm: FrontMatterCache) => {
                    setNestedProperty(fm, this.bannerPositionProperty, value);
                })
            })
        )
        positionSetting.settingEl.classList.add("position-setting")
    }

    onClose() {
        const {contentEl} = this
        contentEl.empty()
    } 
}