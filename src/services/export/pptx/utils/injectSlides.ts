// Post-process PPTX blob to inject reference slide XML for slides 3 & 4

import { SLIDE3_XML, SLIDE4_XML, SLIDE3_RELS, SLIDE4_RELS } from '../data/referenceSlideXml';

/**
 * IBM reference theme color scheme values.
 * The reference deck uses an inverted color map (bg1→dk1, tx1→lt1)
 * where dk1=FFFFFF and lt1=000000, so schemeClr refs like "bg1"
 * resolve to white (FFFFFF) via the dk1 slot.
 */
const IBM_THEME_COLORS: Record<string, string> = {
  dk1: 'FFFFFF',
  lt1: '000000',
  dk2: 'FFFFFF',
  lt2: '000000',
  accent1: '0F62FE',
  accent2: 'A56EFF',
  accent3: '003A6D',
  accent4: '009D9A',
  accent5: '9F1853',
  accent6: 'FA4D56',
  hlink: '0F62FE',
  folHlink: '6F6F6F',
};

/**
 * Replace slides 3 & 4 in a PPTX blob with reference IBM deck XML,
 * and fix theme colors so schemeClr references resolve correctly.
 */
export async function injectReferenceSlides(blob: Blob): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);

  // Replace slide XML content
  zip.file('ppt/slides/slide3.xml', SLIDE3_XML);
  zip.file('ppt/slides/slide4.xml', SLIDE4_XML);

  // Replace rels to remove image/notes references
  zip.file('ppt/slides/_rels/slide3.xml.rels', SLIDE3_RELS);
  zip.file('ppt/slides/_rels/slide4.xml.rels', SLIDE4_RELS);

  // Fix theme colors to match IBM reference theme
  await fixThemeColors(zip);

  // Fix slide master color map to use inverted mapping
  await fixColorMap(zip);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Update the theme color scheme to match IBM reference values.
 * Our pptxgenjs slides use hardcoded srgbClr values so they're unaffected.
 */
async function fixThemeColors(zip: JSZip): Promise<void> {
  const themePath = 'ppt/theme/theme1.xml';
  const themeFile = zip.file(themePath);
  if (!themeFile) return;

  let xml = await themeFile.async('string');

  // Replace each color scheme element value
  for (const [name, value] of Object.entries(IBM_THEME_COLORS)) {
    // Match <a:dk1><a:srgbClr val="..."/></a:dk1> or <a:dk1><a:sysClr .../>...</a:dk1>
    const tagRegex = new RegExp(
      `(<a:${name}>)(<a:s(?:rgb|ys)Clr[^/]*(?:val="[^"]*")[^/]*)(/?>(?:</a:s(?:rgb|ys)Clr>)?)(</a:${name}>)`,
      'g'
    );
    xml = xml.replace(tagRegex, `$1<a:srgbClr val="${value}"/>$4`);
  }

  zip.file(themePath, xml);
}

/**
 * Update the slide master color map to use the inverted IBM mapping:
 * bg1→dk1, tx1→lt1, bg2→dk2, tx2→lt2
 * This ensures schemeClr "bg1" resolves to dk1 (FFFFFF = white).
 */
async function fixColorMap(zip: JSZip): Promise<void> {
  const masterPath = 'ppt/slideMasters/slideMaster1.xml';
  const masterFile = zip.file(masterPath);
  if (!masterFile) return;

  let xml = await masterFile.async('string');

  // Replace the clrMap attributes
  xml = xml.replace(
    /clrMap[^/]*\/>/,
    'clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
  );

  zip.file(masterPath, xml);
}
