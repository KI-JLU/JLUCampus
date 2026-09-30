/** Contents of the Linux desktop entry used for autostart. */
export function linuxAutostartContent(executable: string): string {
  const quoted = `"${executable.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
  return `[Desktop Entry]\nType=Application\nName=JLU Campus\nExec=${quoted} --autostart\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`
}
