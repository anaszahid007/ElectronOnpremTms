export const DEFAULT_PAGE_SIZE = 50
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
export const MAX_PAGE_SIZE = 1000

/**
 * Virtual printers that cannot print silently — their driver UI (fax wizard,
 * OneNote, XPS save dialog) only works through the Windows print dialog.
 * "Microsoft Print to PDF" is deliberately NOT matched: it prints fine silently.
 */
export const DIALOG_ONLY_PRINTER = /fax|onenote|xps|send to|document writer/i

export function isDialogOnlyPrinter(name: string): boolean {
  return DIALOG_ONLY_PRINTER.test(name)
}
