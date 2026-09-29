/** A setting the settings column can be opened at. */
export type SettingsSectionId = 'language' | 'appearance'

/** Ids of the settings' controls, so the column can be opened with focus on one of them. */
export const SETTINGS_CONTROL_ID: Record<SettingsSectionId, string> = {
  language: 'settings-language',
  appearance: 'settings-appearance'
}

/**
 * Focuses a setting's control once the column shows it; the colour scheme's is the option currently
 * chosen. A menu that opened the settings gives focus back to its trigger after it has gone, so
 * this waits for open menus to close and then for that hand-back.
 */
export function focusSetting(section: SettingsSectionId, frames = 30): void {
  requestAnimationFrame(() => {
    if (document.querySelector('[role="menu"]') && frames > 0) {
      focusSetting(section, frames - 1)
      return
    }
    setTimeout(() => {
      const control = document.getElementById(SETTINGS_CONTROL_ID[section])
      const target =
        section === 'appearance'
          ? control?.querySelector<HTMLElement>('[aria-pressed="true"]')
          : control
      target?.focus()
    })
  })
}
