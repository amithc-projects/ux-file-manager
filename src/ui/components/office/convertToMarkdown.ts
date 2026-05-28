/**
 * convertToMarkdown
 *
 * Converts DOCX, PPTX, and XLSX files to Markdown in the browser using
 * officeparser's OfficeConverter API. The library is dynamically imported
 * so it is not bundled into the main IIFE — it loads on first use and is
 * cached by the browser.
 */

export type OfficeExt = 'docx' | 'pptx' | 'xlsx';

export const OFFICE_EXTS: OfficeExt[] = ['docx', 'pptx', 'xlsx'];

export function isOfficeFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return OFFICE_EXTS.includes(ext as OfficeExt);
}

/**
 * Convert an office file to a Markdown string.
 * Returns the markdown text, or throws on failure.
 */
export async function convertToMarkdown(file: File): Promise<string> {
  // Dynamic import keeps officeparser out of the IIFE bundle — loads on demand.
  const { OfficeConverter } = await import(/* @vite-ignore */ 'officeparser');

  const arrayBuffer = await file.arrayBuffer();

  const result = await OfficeConverter.convert(arrayBuffer, 'md', {
    parseConfig: { outputErrorToConsole: false },
  });

  return cleanMarkdown((result.value as string).trim());
}

/**
 * Post-process officeparser's markdown output to remove common artefacts:
 *
 * 1. Unwrap <div style="text-align: center">...</div> → inner content only.
 *    Markdown has no native centring; the HTML wrapper is noise for most
 *    downstream uses (LLM prompts, note apps, plain editors).
 *
 * 2. Strip {#anchor-id} heading anchors appended by officeparser.
 *    Valid in Pandoc/GFM but distracting when copying to non-Pandoc targets.
 *
 * 3. Collapse runs of 3+ consecutive blank lines to a single blank line.
 *    DOCX uses empty paragraphs for visual spacing; each becomes a blank
 *    line, producing large gaps in the output.
 */
function cleanMarkdown(md: string): string {
  // 1. Unwrap centred divs — handle optional inner newlines and whitespace.
  //    Matches both single-line and multi-line variants:
  //      <div style="text-align: center">content</div>
  //      <div style="text-align: center">\ncontent\n</div>
  md = md.replace(/<div\s+style="text-align:\s*center">\s*([\s\S]*?)\s*<\/div>/g, (_match, inner) => inner.trim());

  // 2. Strip {#some-anchor-id} from headings (and anywhere else they appear).
  md = md.replace(/\s*\{#[^}]+\}/g, '');

  // 3. Collapse 3+ consecutive blank lines to exactly one blank line.
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

/**
 * Trigger a browser download of a Markdown file.
 */
export function downloadMarkdown(markdown: string, originalFilename: string): void {
  const mdFilename = originalFilename.replace(/\.[^.]+$/, '.md');
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = mdFilename;
  a.click();
  URL.revokeObjectURL(url);
}
