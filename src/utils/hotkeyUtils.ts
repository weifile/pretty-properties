import { App } from "obsidian";

// Obsidian's hotkey manager / settings dialog are not in the public API; typed loosely here.
interface HotkeyManagerLike {
    printHotkeyForCommand?: (commandId: string) => string
}
interface HotkeysTabLike {
    searchComponent?: { setValue: (v: string) => void; inputEl?: HTMLInputElement }
    updateHotkeyVisibility?: () => void
}
interface SettingDialogLike {
    open: () => void
    openTabById: (id: string) => unknown
    activeTab?: HotkeysTabLike
}

/** Human-readable hotkey currently bound to a command, or the fallback text */
export const describeHotkey = (app: App, commandId: string, fallback: string) => {
    const manager = (app as unknown as { hotkeyManager?: HotkeyManagerLike }).hotkeyManager
    const text = manager?.printHotkeyForCommand?.(commandId)
    return text && text.trim() ? text : fallback
}

/** Open Obsidian's Hotkeys settings tab with the search box prefilled for one command */
export const openHotkeySettings = (app: App, search: string) => {
    const setting = (app as unknown as { setting?: SettingDialogLike }).setting
    if (!setting) return
    setting.open()
    setting.openTabById("hotkeys")
    const tab = setting.activeTab
    if (tab?.searchComponent) {
        tab.searchComponent.setValue(search)
        if (tab.searchComponent.inputEl) tab.searchComponent.inputEl.value = search
        tab.updateHotkeyVisibility?.()
    }
}
