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
  chartPngDataUrl?: string | null;
  generatedAt?: Date;
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

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    // Inline computed background for clean white report print
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', '#ffffff');
    clone.insertBefore(bgRect, clone.firstChild);

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
  const { scenario, analysis, elevationSource, chartPngDataUrl } = options;
  const generatedAt = options.generatedAt ?? new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const verdictLabel = analysis.overallVerdict.toUpperCase();
  const verdictColor: [number, number, number] =
    analysis.overallVerdict === 'pass'
      ? [15, 123, 85]
      : analysis.overallVerdict === 'marginal'
        ? [180, 83, 9]
        : [200, 30, 30];

  // Header Banner
  doc.setFillColor(15, 27, 43);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('LinkSight RF — Site Survey & Link Budget Report', 14, 12);
  doc.setFontSize(9.5);
  doc.setTextColor(190, 205, 222);
  doc.text(
    `Scenario: ${scenario.name}  |  Mode: ${scenario.mode === 'relay' ? 'Single-Repeater Relay' : 'Point-to-Point'}  |  DEM: ${elevationSource}`,
    14,
    20,
  );

  // Verdict badge
  doc.setFillColor(...verdictColor);
  doc.roundedRect(166, 7, 30, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.text(verdictLabel, 181, 13, { align: 'center' });

  // Executive Summary metrics
  doc.setTextColor(15, 27, 43);
  doc.setFontSize(11);
  doc.text('1. Site Coordinates & Path Geometry', 14, 37);

  const siteRows = [
    [
      'TX Site',
      scenario.tx.name,
      `${scenario.tx.coords.lat.toFixed(5)}, ${scenario.tx.coords.lng.toFixed(5)}`,
      `${analysis.hops[0]?.txSite.groundElevationM.toFixed(0) ?? scenario.tx.groundElevationM} m ASL`,
      `${scenario.tx.antennaHeightM} m AGL`,
      `${scenario.tx.txPowerDbm} dBm / ${scenario.tx.antennaGainDbi} dBi`,
    ],
    ...(scenario.mode === 'relay'
      ? [
          [
            'Repeater',
            scenario.repeater.name,
            `${scenario.repeater.coords.lat.toFixed(5)}, ${scenario.repeater.coords.lng.toFixed(5)}`,
            `${analysis.hops[0]?.rxSite.groundElevationM.toFixed(0) ?? scenario.repeater.groundElevationM} m ASL`,
            `${scenario.repeater.antennaHeightM} m AGL`,
            `${scenario.repeater.txPowerDbm} dBm / ${scenario.repeater.antennaGainDbi} dBi`,
          ],
        ]
      : []),
    [
      'RX Site',
      scenario.rx.name,
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

  // Hop Azimuth & Fresnel Summary
  const hopSummaryRows = analysis.hops.map((hop) => [
    hop.label,
    `${hop.distanceKm.toFixed(2)} km`,
    `${hop.forwardAzimuthDeg.toFixed(1)}° / ${hop.reverseAzimuthDeg.toFixed(1)}°`,
    `${hop.rslDbm.toFixed(1)} dBm`,
    `${hop.fadeMarginDb.toFixed(1)} dB`,
    `${(hop.minClearanceRatio * 100).toFixed(0)}% F1`,
    hop.verdict.toUpperCase(),
  ]);

  if (analysis.directReference) {
    hopSummaryRows.push([
      analysis.directReference.label,
      `${analysis.directReference.distanceKm.toFixed(2)} km`,
      `${analysis.directReference.forwardAzimuthDeg.toFixed(1)}° / ${analysis.directReference.reverseAzimuthDeg.toFixed(1)}°`,
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

  doc.setFontSize(11);
  doc.setTextColor(15, 27, 43);
  doc.text('2. Terrain Elevation & 1st Fresnel Zone Profile', 14, yAfterSites);

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

  // Engineering findings
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
      findings.push(
        `${hop.label}: Worst clearance at ${hop.heightAdvisor.worstDistanceKm.toFixed(1)} km. Add +${hop.heightAdvisor.extraBalancedM.toFixed(1)} m to both towers (or +${hop.heightAdvisor.extraTxOnlyM.toFixed(1)} m TX / +${hop.heightAdvisor.extraRxOnlyM.toFixed(1)} m RX) to reach 60% F1.`,
      );
    } else {
      findings.push(
        `${hop.label}: Meets >= 60% 1st Fresnel clearance (${(hop.minClearanceRatio * 100).toFixed(0)}% F1, worst ν = ${hop.worstNu.toFixed(2)}).`,
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
    const wrapped = doc.splitTextToSize(`• ${line}`, 180) as string[];
    doc.text(wrapped, 14, cursorY);
    cursorY += wrapped.length * 4.5 + 1.5;
  }

  // Page 2: Itemized Link Budget Tables
  doc.addPage();
  doc.setFillColor(15, 27, 43);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('4. Itemized RF Link Budget Breakdown', 14, 11.5);

  let budgetY = 26;
  for (const hop of analysis.hops) {
    doc.setFontSize(10.5);
    doc.setTextColor(15, 27, 43);
    doc.text(
      `${hop.label} (${hop.distanceKm.toFixed(2)} km @ ${scenario.propagation.frequencyMhz} MHz)`,
      14,
      budgetY,
    );

    autoTable(doc, {
      startY: budgetY + 3,
      head: [['Budget Component', 'Value', 'Notes']],
      body: hop.budgetItems.map((item) => [
        item.label,
        `${item.valueDb >= 0 && item.unit === 'dB' ? '+' : ''}${item.valueDb.toFixed(2)} ${item.unit}`,
        item.note ?? '',
      ]),
      styles: { fontSize: 8.2, cellPadding: 2 },
      headStyles: { fillColor: [2, 100, 152] },
      margin: { left: 14, right: 14 },
    });

    budgetY =
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? budgetY + 70) + 9;
  }

  // Propagation assumptions footer
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Assumptions: Frequency ${scenario.propagation.frequencyMhz} MHz | Model: ${scenario.propagation.model} | k-factor: ${scenario.propagation.kFactor.toFixed(3)} | Clutter: ${scenario.propagation.clutterHeightM} m | Rain Margin: ${scenario.propagation.rainMarginDb} dB`,
    14,
    Math.min(276, budgetY + 2),
  );
  doc.text(
    `Generated by LinkSight RF (rf.andresptr.site) on ${generatedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC. Preliminary planning tool — verify field obstacles & regulatory EIRP limits prior to deployment.`,
    14,
    286,
  );

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
