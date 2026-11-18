import {
  DamageEntry,
  PriorityLevel,
  RestorationStage,
  RestorationState,
  SectorAssessmentItem,
  SeverityLevel,
} from '../types/mis';

export function formatNPR(amount: number, compact = false, lang: 'en' | 'ne' = 'en'): string {
  const num = Number(amount) || 0;
  if (lang === 'ne') {
    if (compact) {
      if (num >= 10000000) return `रु. ${(num / 10000000).toFixed(2)} करोड`;
      if (num >= 100000) return `रु. ${(num / 100000).toFixed(2)} लाख`;
    }
    return `रु. ${num.toLocaleString('en-IN')}`;
  }
  if (compact) {
    if (num >= 10000000) return `NPR ${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `NPR ${(num / 100000).toFixed(2)} Lakh`;
  }
  return `NPR ${num.toLocaleString('en-IN')}`;
}

export function getEntrySectorItems(entry: DamageEntry): SectorAssessmentItem[] {
  if (entry.sectorItems && entry.sectorItems.length > 0) {
    return entry.sectorItems;
  }
  return [
    {
      id: `${entry.id}-primary`,
      sector: entry.sector,
      standardId: entry.standardId,
      standardName: entry.standardName,
      severity: entry.severity,
      unit: entry.unit,
      qty: entry.qty,
      lossNPR: entry.lossNPR,
      answers: {},
      restoration: entry.restoration,
    },
  ];
}

export function getItemRestoration(
  entry: DamageEntry,
  item: SectorAssessmentItem
): RestorationState {
  if (item.restoration) {
    return {
      stage: item.restoration.stage || 'Not Started',
      progress: Number(item.restoration.progress) || 0,
      budget: Number(item.restoration.budget) || 0,
      spent: Number(item.restoration.spent) || 0,
      agency: item.restoration.agency || entry.municipality || '',
      targetDate: item.restoration.targetDate || '',
      logs: Array.isArray(item.restoration.logs) ? item.restoration.logs : [],
    };
  }
  const base = entry.restoration;
  const totalItems = Math.max(1, entry.sectorItems?.length || 1);
  return {
    stage: base?.stage || 'Not Started',
    progress: Number(base?.progress) || 0,
    budget:
      totalItems === 1
        ? Number(base?.budget ?? item.lossNPR) || 0
        : Number(item.lossNPR) || 0,
    spent: totalItems === 1 ? Number(base?.spent) || 0 : 0,
    agency: base?.agency || entry.municipality || '',
    targetDate: base?.targetDate || '',
    logs: totalItems === 1 && Array.isArray(base?.logs) ? base.logs : [],
  };
}

export function summarizeEntryRestoration(
  entry: DamageEntry,
  items: SectorAssessmentItem[],
  newLogEntry?: { date: string; note: string }
): RestorationState {
  const itemStates = items.map((item) => getItemRestoration(entry, item));
  const count = Math.max(1, itemStates.length);
  const totalBudget = itemStates.reduce((acc, s) => acc + (Number(s.budget) || 0), 0);
  const totalSpent = itemStates.reduce((acc, s) => acc + (Number(s.spent) || 0), 0);
  const avgProgress = Math.round(
    itemStates.reduce((acc, s) => acc + (Number(s.progress) || 0), 0) / count
  );

  let derivedStage: RestorationStage = 'Not Started';
  if (itemStates.every((s) => s.stage === 'Restored')) {
    derivedStage = 'Restored';
  } else if (itemStates.some((s) => s.stage === 'In Progress' || s.stage === 'Restored')) {
    derivedStage = 'In Progress';
  } else if (itemStates.some((s) => s.stage === 'Procurement / Tender')) {
    derivedStage = 'Procurement / Tender';
  } else if (itemStates.some((s) => s.stage === 'Technical Assessment')) {
    derivedStage = 'Technical Assessment';
  }

  const agencies = Array.from(
    new Set(itemStates.map((s) => s.agency.trim()).filter(Boolean))
  );
  const targetDates = itemStates
    .map((s) => s.targetDate.trim())
    .filter(Boolean)
    .sort();

  const existingLogs = [...(entry.restoration?.logs || [])];
  if (newLogEntry) {
    existingLogs.push(newLogEntry);
  }

  return {
    stage: derivedStage,
    progress: avgProgress,
    budget: totalBudget,
    spent: totalSpent,
    agency: agencies.join(', ') || entry.restoration?.agency || entry.municipality || '',
    targetDate:
      targetDates[targetDates.length - 1] || entry.restoration?.targetDate || '',
    logs: existingLogs.slice(-100),
  };
}

export function severityTextStyle(severity: SeverityLevel): string {
  switch (severity) {
    case 'Catastrophic':
      return 'text-red-700 font-semibold';
    case 'Severe':
      return 'text-orange-700 font-semibold';
    case 'Moderate':
      return 'text-amber-700 font-medium';
    default:
      return 'text-slate-600 font-medium';
  }
}

export function stageTextStyle(stage: RestorationStage): string {
  switch (stage) {
    case 'Restored':
      return 'text-emerald-700 font-semibold';
    case 'In Progress':
      return 'text-blue-700 font-semibold';
    case 'Procurement / Tender':
      return 'text-amber-700 font-medium';
    case 'Technical Assessment':
      return 'text-indigo-700 font-medium';
    default:
      return 'text-slate-600 font-medium';
  }
}

export function priorityTextStyle(priority: PriorityLevel): string {
  switch (priority) {
    case 'Critical':
      return 'text-red-700 font-semibold';
    case 'High':
      return 'text-orange-700 font-semibold';
    case 'Medium':
      return 'text-amber-700 font-medium';
    default:
      return 'text-slate-600 font-medium';
  }
}

export function exportEntriesCSV(entries: DamageEntry[]): void {
  const headers = [
    'ID',
    'Date',
    'Province',
    'District',
    'Municipality',
    'Ward',
    'Tole',
    'Latitude',
    'Longitude',
    'Hazard',
    'Title',
    'Deaths',
    'Missing',
    'Injured',
    'Affected_Families',
    'Fully_Displaced_Families',
    'Temp_Displaced_Families',
    'Affected_Pop',
    'Primary_Sector',
    'Items_Count',
    'Sector_Assessments_Summary',
    'Total_Est_Loss_NPR',
    'Verification',
    'Priority',
    'Officer',
    'Relief_Duration_Days',
    'Relief_Items_Requested',
    'Restoration_Stage',
    'Restoration_Pct',
    'Allocated_Budget_NPR',
    'Spent_NPR',
  ];

  const rows = entries.map((e) => {
    const items = getEntrySectorItems(e);
    const summary = items
      .map((item) => {
        const qa = Object.entries(item.answers || {})
          .filter(([, v]) => Boolean(v))
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
        return `${item.sector}: ${item.standardName} (${item.qty} ${item.unit}, NPR ${item.lossNPR})${
          qa ? ` [${qa}]` : ''
        }`;
      })
      .join(' | ');

    const reliefSummary = (e.reliefItems || [])
      .map(
        (ri) =>
          `${ri.name}: ${ri.qty} ${ri.unit}${ri.notes ? ` (${ri.notes})` : ''}`
      )
      .join(' | ');

    const tempDisplaced =
      typeof e.tempDisplaced === 'number'
        ? e.tempDisplaced
        : Math.max(0, (e.affectedHH || 0) - (e.fullyDisplaced || 0));

    return [
      e.id,
      e.date,
      e.province,
      e.district,
      e.municipality,
      e.ward,
      e.tole,
      e.lat,
      e.lng,
      e.hazard,
      e.title,
      e.deaths ?? 0,
      e.missing ?? 0,
      e.injured ?? 0,
      e.affectedHH,
      e.fullyDisplaced ?? 0,
      tempDisplaced,
      e.affectedPop,
      e.sector,
      items.length,
      summary,
      e.lossNPR,
      e.verification,
      e.priority,
      e.officer,
      e.reliefItems && e.reliefItems.length > 0 ? e.reliefDurationDays ?? 21 : '',
      reliefSummary,
      e.trackRestoration ? e.restoration?.stage || 'Not Started' : 'Not Tracked',
      e.trackRestoration ? e.restoration?.progress ?? 0 : 0,
      e.trackRestoration ? e.restoration?.budget ?? 0 : 0,
      e.trackRestoration ? e.restoration?.spent ?? 0 : 0,
    ]
      .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
      .join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nepal-loss-damage-mis-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
