import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ElevationSource,
  LinkAnalysisResult,
  LinkScenario,
} from '@linksight/rf-engine';

export interface SiteSurveyPdfOptions {
  scenario: LinkScenario;
  analysis: LinkAnalysisResult;
  elevationSource: ElevationSource;
  chartHopLabel?: string;
  chartPngDataUrl?: string | null;
  generatedAt?: Date;
}

const PRINT_CSS_VAR_MAP: Record<string, string> = {
  '--bg-canvas': '#f4f6f8',
  '--bg-panel': '#ffffff',
  '--bg-elevated': '#eef2f6',
  '--border-subtle': '#d5dde5',
  '--border-strong': '#b8c6d4',
  '--text-primary': '#0f1b2b',
  '--text-secondary': '#475569',
  '--accent': '#026498',
  '--accent-ink': '#ffffff',
  '--role-tx': '#026498',
  '--role-rpt': '#c2610c',
  '--role-rx': '#0f7b55',
  '--status-pass': '#0f7b55',
  '--status-pass-bg': '#e6f6ef',
  '--status-marginal': '#b45309',
  '--status-marginal-bg': '#fef3dc',
  '--status-fail': '#c81e1e',
  '--status-fail-bg': '#fde8e8',
  '--terrain-fill': '#cbd5e1',
  '--terrain-fill-top': '#94a3b8',
  '--terrain-fill-bottom': '#e2e8f0',
  '--terrain-stroke': '#475569',
  '--clutter-fill': '#64748b',
  '--grid-line': '#dbe3ec',
};

function replaceCssVars(raw: string): string {
  return raw.replace(/var\((--[a-z0-9-]+)(?:,\s*([^)]+))?\)/gi, (_, name: string, fallback?: string) => {
    return PRINT_CSS_VAR_MAP[name] ?? fallback?.trim() ?? '#334155';
  });
}

export function sanitizePdfText(text: string): string {
  return text
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/ν/g, 'nu')
    .replace(/–|—/g, '-')
    .replace(/≈/g, '~')
    .replace(/•/g, '-')
    .replace(/…/g, '...');
}

export function resolveSvgCssVarsForPrint(
  svgEl: SVGSVGElement,
  width?: number,
  height?: number,
): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-hover-overlay="true"]').forEach((node) => node.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (width !== undefined) clone.setAttribute('width', String(width));
  if (height !== undefined) clone.setAttribute('height', String(height));
  clone.setAttribute('font-family', 'Helvetica, Arial, sans-serif');

  const bgRect = clone.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', '0');
  bgRect.setAttribute('y', '0');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', '#ffffff');
  clone.insertBefore(bgRect, clone.firstChild);

  const elements: Element[] = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (const el of elements) {
    for (const attr of ['fill', 'stroke', 'color', 'stop-color', 'style']) {
      const val = el.getAttribute(attr);
      if (val && val.includes('var(')) {
        el.setAttribute(attr, replaceCssVars(val));
      }
    }
    if (el.tagName.toLowerCase() === 'text' && el.classList.contains('font-mono-num')) {
      el.setAttribute('font-family', 'Courier New, monospace');
    }
  }

  return clone;
}

export async function svgElementToPngDataUrl(
  svgEl: SVGSVGElement | null,
  scale = 2,
): Promise<string | null> {
  if (!svgEl || typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  try {
    const rect = svgEl.getBoundingClientRect();
    const width = Math.max(640, Math.round(rect.width || 800));
    const height = Math.max(240, Math.round(rect.height || 280));

    const clone = resolveSvgCssVarsForPrint(svgEl, width, height);
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const dataUrl = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });

    return dataUrl;
  } catch {
    return null;
  }
}

export function buildSiteSurveyPdfDoc(options: SiteSurveyPdfOptions): jsPDF {
  const { scenario, analysis, elevationSource, chartHopLabel, chartPngDataUrl } =
    options;
  const generatedAt = options.generatedAt ?? new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const verdictLabel = analysis.overallVerdict.toUpperCase();
  const verdictColor: [number, number, number] =
    analysis.overallVerdict === 'pass'
      ? [15, 123, 85]
      : analysis.overallVerdict === 'marginal'
        ? [180, 83, 9]
        : [200, 30, 30];

  doc.setFillColor(15, 27, 43);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('LinkSight RF - Site Survey & Link Budget Report', 14, 12);
  doc.setFontSize(9.5);
  doc.setTextColor(190, 205, 222);
  doc.text(
    sanitizePdfText(
      `Scenario: ${scenario.name}  |  Mode: ${scenario.mode === 'relay' ? 'Single-Repeater Relay' : 'Point-to-Point'}  |  DEM: ${elevationSource}`,
    ),
    14,
    20,
  );

  doc.setFillColor(...verdictColor);
  doc.roundedRect(166, 7, 30, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.text(verdictLabel, 181, 13, { align: 'center' });

  doc.setTextColor(15, 27, 43);
  doc.setFontSize(11);
  doc.text('1. Site Coordinates & Path Geometry', 14, 37);

  const siteRows = [
    [
      'TX Site',
      sanitizePdfText(scenario.tx.name),
      `${scenario.tx.coords.lat.toFixed(5)}, ${scenario.tx.coords.lng.toFixed(5)}`,
      `${analysis.hops[0]?.txSite.groundElevationM.toFixed(0) ?? scenario.tx.groundElevationM} m ASL`,
      `${scenario.tx.antennaHeightM} m AGL`,
      `${scenario.tx.txPowerDbm} dBm / ${scenario.tx.antennaGainDbi} dBi`,
    ],
    ...(scenario.mode === 'relay'
      ? [
          [
            'Repeater',
            sanitizePdfText(scenario.repeater.name),
            `${scenario.repeater.coords.lat.toFixed(5)}, ${scenario.repeater.coords.lng.toFixed(5)}`,
            `${analysis.hops[0]?.rxSite.groundElevationM.toFixed(0) ?? scenario.repeater.groundElevationM} m ASL`,
            `${scenario.repeater.antennaHeightM} m AGL`,
            `${scenario.repeater.txPowerDbm} dBm / ${scenario.repeater.antennaGainDbi} dBi`,
          ],
        ]
      : []),
    [
      'RX Site',
      sanitizePdfText(scenario.rx.name),
      `${scenario.rx.coords.lat.toFixed(5)}, ${scenario.rx.coords.lng.toFixed(5)}`,
      `${analysis.hops[analysis.hops.length - 1]?.rxSite.groundElevationM.toFixed(0) ?? scenario.rx.groundElevationM} m ASL`,
      `${scenario.rx.antennaHeightM} m AGL`,
      `Sens ${scenario.rx.rxSensitivityDbm} dBm / ${scenario.rx.antennaGainDbi} dBi`,
    ],
  ];

  autoTable(doc, {
    startY: 40,
    head: [['Role', 'Site Name', 'Coordinates', 'Ground', 'Tower', 'RF Specs']],
    body: siteRows,
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: [2, 100, 152] },
    margin: { left: 14, right: 14 },
  });

  let yAfterSites =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? 76) + 7;

  const hopSummaryRows = analysis.hops.map((hop) => [
    sanitizePdfText(hop.label),
    `${hop.distanceKm.toFixed(2)} km`,
    `${hop.forwardAzimuthDeg.toFixed(1)} deg / ${hop.reverseAzimuthDeg.toFixed(1)} deg`,
    `${hop.rslDbm.toFixed(1)} dBm`,
    `${hop.fadeMarginDb.toFixed(1)} dB`,
    `${(hop.minClearanceRatio * 100).toFixed(0)}% F1`,
    hop.verdict.toUpperCase(),
  ]);

  if (analysis.directReference) {
    hopSummaryRows.push([
      sanitizePdfText(analysis.directReference.label),
      `${analysis.directReference.distanceKm.toFixed(2)} km`,
      `${analysis.directReference.forwardAzimuthDeg.toFixed(1)} deg / ${analysis.directReference.reverseAzimuthDeg.toFixed(1)} deg`,
      `${analysis.directReference.rslDbm.toFixed(1)} dBm`,
      `${analysis.directReference.fadeMarginDb.toFixed(1)} dB`,
      `${(analysis.directReference.minClearanceRatio * 100).toFixed(0)}% F1`,
      `${analysis.directReference.verdict.toUpperCase()} (Ref)`,
    ]);
  }

  autoTable(doc, {
    startY: yAfterSites,
    head: [
      ['Segment', 'Distance', 'Azimuth TX/RX', 'RSL', 'Fade Margin', 'Min Clear.', 'Status'],
    ],
    body: hopSummaryRows,
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });

  yAfterSites =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? 112) + 8;

  const profileHeading = chartHopLabel
    ? `2. Terrain Elevation & 1st Fresnel Zone Profile (${sanitizePdfText(chartHopLabel)})`
    : '2. Terrain Elevation & 1st Fresnel Zone Profile';

  doc.setFontSize(11);
  doc.setTextColor(15, 27, 43);
  doc.text(profileHeading, 14, yAfterSites);

  if (chartPngDataUrl) {
    doc.addImage(chartPngDataUrl, 'PNG', 14, yAfterSites + 3, 182, 64);
    yAfterSites += 72;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Profile visualization available in interactive web view (headless vector export mode).',
      14,
      yAfterSites + 7,
    );
    yAfterSites += 14;
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 27, 43);
  doc.text('3. Engineering Findings & Tower Height Recommendations', 14, yAfterSites + 4);

  const findings: string[] = [];
  if (analysis.relayComparison) {
    const cmp = analysis.relayComparison;
    findings.push(
      `Relay vs. Direct Gain: ${cmp.fadeMarginGainDb >= 0 ? '+' : ''}${cmp.fadeMarginGainDb.toFixed(1)} dB fade margin improvement (${cmp.directVerdict.toUpperCase()} -> ${cmp.relayVerdict.toUpperCase()}) and ${cmp.clearanceGainPercent >= 0 ? '+' : ''}${cmp.clearanceGainPercent.toFixed(0)}% F1 clearance.`,
    );
  }
  for (const hop of analysis.hops) {
    if (hop.heightAdvisor.needed) {
      const txHint =
        hop.heightAdvisor.extraTxOnlyM !== null
          ? `+${hop.heightAdvisor.extraTxOnlyM.toFixed(1)} m TX`
          : 'TX-only N/A';
      const rxHint =
        hop.heightAdvisor.extraRxOnlyM !== null
          ? `+${hop.heightAdvisor.extraRxOnlyM.toFixed(1)} m RX`
          : 'RX-only N/A';
      findings.push(
        `${hop.label}: Worst clearance at ${hop.heightAdvisor.worstDistanceKm.toFixed(1)} km. Add +${hop.heightAdvisor.extraBalancedM.toFixed(1)} m to both towers (${txHint} / ${rxHint}) to reach 60% F1.`,
      );
    } else {
      findings.push(
        `${hop.label}: Meets >= 60% 1st Fresnel clearance (${(hop.minClearanceRatio * 100).toFixed(0)}% F1, worst nu = ${hop.worstNu.toFixed(2)}).`,
      );
    }
    for (const w of hop.warnings) {
      findings.push(`Notice (${hop.label}): ${w}`);
    }
  }

  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);
  let cursorY = yAfterSites + 10;
  for (const line of findings.slice(0, 6)) {
    const wrapped = doc.splitTextToSize(`- ${sanitizePdfText(line)}`, 180) as string[];
    doc.text(wrapped, 14, cursorY);
    cursorY += wrapped.length * 4.5 + 1.5;
  }

  // Page 2+: Itemized Link Budget Breakdown
  doc.addPage();
  doc.setFillColor(15, 27, 43);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('4. Itemized RF Link Budget Breakdown', 14, 11.5);

  let budgetY = 26;
  for (const hop of analysis.hops) {
    if (budgetY > 235) {
      doc.addPage();
      budgetY = 20;
    }

    doc.setFontSize(10.5);
    doc.setTextColor(15, 27, 43);
    doc.text(
      sanitizePdfText(
        `${hop.label} (${hop.distanceKm.toFixed(2)} km @ ${scenario.propagation.frequencyMhz} MHz)`,
      ),
      14,
      budgetY,
    );

    autoTable(doc, {
      startY: budgetY + 3,
      head: [['Budget Component', 'Value', 'Notes']],
      body: hop.budgetItems.map((item) => [
        sanitizePdfText(item.label),
        `${item.valueDb >= 0 && item.unit === 'dB' ? '+' : ''}${item.valueDb.toFixed(2)} ${item.unit}`,
        sanitizePdfText(item.note ?? ''),
      ]),
      styles: { fontSize: 8.2, cellPadding: 2 },
      headStyles: { fillColor: [2, 100, 152] },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    budgetY =
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? budgetY + 70) + 9;
  }

  if (budgetY > 266) {
    doc.addPage();
    budgetY = 20;
  }

  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  const assumptionsText = sanitizePdfText(
    `Assumptions: Frequency ${scenario.propagation.frequencyMhz} MHz | Model: ${scenario.propagation.model} | k-factor: ${scenario.propagation.kFactor.toFixed(3)} | Clutter: ${scenario.propagation.clutterHeightM} m | Rain Margin: ${scenario.propagation.rainMarginDb} dB | Target Fade Margin: ${scenario.propagation.targetFadeMarginDb} dB`,
  );
  doc.text(doc.splitTextToSize(assumptionsText, 182) as string[], 14, budgetY + 2);

  const totalPages = doc.getNumberOfPages();
  const timestamp = generatedAt.toISOString().slice(0, 19).replace('T', ' ');
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated by LinkSight RF (rf.andresptr.site) on ${timestamp} UTC - Preliminary planning tool; verify field obstacles & regulatory EIRP limits. Page ${p} of ${totalPages}`,
      14,
      290,
    );
  }

  return doc;
}

export async function exportSiteSurveyPdf(
  options: Omit<SiteSurveyPdfOptions, 'chartPngDataUrl'> & {
    chartSvgElement?: SVGSVGElement | null;
  },
): Promise<void> {
  const chartPngDataUrl = await svgElementToPngDataUrl(
    options.chartSvgElement ?? null,
  );
  const doc = buildSiteSurveyPdfDoc({
    ...options,
    chartPngDataUrl,
  });
  const slug = options.scenario.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  doc.save(`LinkSight-RF-Survey-${slug || 'report'}.pdf`);
}
