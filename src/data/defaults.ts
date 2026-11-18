import { DamageEntry, DamageStandard, SectorQuestion } from '../types/mis';

export const HAZARD_TYPES = [
  'Flood',
  'Landslide',
  'Earthquake',
  'Fire',
  'Windstorm / Hailstorm',
  'Lightning',
  'GLOF / Flash Flood',
  'Drought',
  'Cold Wave',
  'Other',
];

export const RESTORATION_STAGES = [
  'Not Started',
  'Technical Assessment',
  'Procurement / Tender',
  'In Progress',
  'Restored',
] as const;

export const DEFAULT_SECTORS: string[] = [
  'Housing & Shelter',
  'Roads & Bridges',
  'Agriculture & Livestock',
  'Education',
  'Public Buildings',
  'Energy & Power',
  'Water & Sanitation (WASH)',
  'Health',
  'Other',
];

export const SECTOR_SUGGESTIONS = DEFAULT_SECTORS;

export const DEFAULT_SECTOR_QUESTIONS: Record<string, SectorQuestion[]> = {
  'Housing & Shelter': [
    {
      id: 'q-hsg-typology',
      label: 'Primary Building Typology',
      type: 'select',
      options: ['Stone & Mud Mortar (SSM)', 'Brick & Cement', 'RCC Frame', 'Timber / Bamboo'],
      required: false,
    },
    {
      id: 'q-hsg-grade',
      label: 'PDNA Structural Damage Grade',
      type: 'select',
      options: ['Grade 1-2 (Minor)', 'Grade 3 (Partial)', 'Grade 4-5 (Severe / Collapsed)'],
      required: false,
    },
    {
      id: 'q-hsg-shelter',
      label: 'Immediate Temporary Shelter / Tarpaulin Needed?',
      type: 'yesno',
      required: false,
    },
  ],
  'Roads & Bridges': [
    {
      id: 'q-rds-class',
      label: 'Road / Bridge Classification',
      type: 'select',
      options: [
        'National Highway',
        'Provincial / Feeder Road',
        'Rural / Palika Road',
        'Bridge Crossing',
      ],
      required: false,
    },
    {
      id: 'q-rds-traffic',
      label: 'Current Traffic Accessibility',
      type: 'select',
      options: ['Completely Blocked', 'Single-Lane / Pedestrian Only', 'Passable with Risk'],
      required: false,
    },
    {
      id: 'q-rds-gabion',
      label: 'Emergency Bailey / Diversion / Gabion Needed?',
      type: 'yesno',
      required: false,
    },
  ],
  'Water & Sanitation (WASH)': [
    {
      id: 'q-wsh-system',
      label: 'Water System Type Affected',
      type: 'select',
      options: [
        'Gravity Flow Piped Scheme',
        'Handpump / Tubewell',
        'Spring Source / Kuwa',
        'Sanitation / Public Toilet',
      ],
      required: false,
    },
    {
      id: 'q-wsh-supply',
      label: 'Drinking Water Supply Status',
      type: 'select',
      options: ['Completely Cut Off', 'Partially Disrupted / Turbid', 'Operational'],
      required: false,
    },
    {
      id: 'q-wsh-emergency',
      label: 'Emergency Water Trucking / Chlorine Needed?',
      type: 'yesno',
      required: false,
    },
  ],
  'Agriculture & Livestock': [
    {
      id: 'q-agr-commodity',
      label: 'Primary Crop or Livestock Affected',
      type: 'select',
      options: ['Cattle / Buffalo / Goats', 'Poultry', 'Paddy / Rice', 'Maize / Vegetables'],
      required: false,
    },
    {
      id: 'q-agr-canal',
      label: 'Veterinary / Carcass Disposal or Fodder Needed?',
      type: 'yesno',
      required: false,
    },
    {
      id: 'q-agr-support',
      label: 'Immediate Agricultural / Livestock Relief Needed',
      type: 'text',
      required: false,
    },
  ],
  Education: [
    {
      id: 'q-edu-level',
      label: 'Institution Level',
      type: 'select',
      options: ['ECD / Primary (1-5)', 'Basic (1-8)', 'Secondary (9-12)', 'Campus / Technical'],
      required: false,
    },
    {
      id: 'q-edu-suspended',
      label: 'Classes Currently Suspended?',
      type: 'yesno',
      required: false,
    },
    {
      id: 'q-edu-students',
      label: 'Affected Students Count',
      type: 'number',
      required: false,
    },
  ],
  Health: [
    {
      id: 'q-hlt-facility',
      label: 'Health Facility Category',
      type: 'select',
      options: [
        'Health Post / Basic Health Center',
        'Primary Hospital',
        'District / Provincial Hospital',
        'Birthing Center',
      ],
      required: false,
    },
    {
      id: 'q-hlt-services',
      label: 'Essential Health Services Operational?',
      type: 'select',
      options: ['Halted', 'Emergency Only', 'Operational'],
      required: false,
    },
    {
      id: 'q-hlt-coldchain',
      label: 'Cold Chain / Medical Equipment Damaged?',
      type: 'yesno',
      required: false,
    },
  ],
  'Energy & Power': [
    {
      id: 'q-eng-asset',
      label: 'Power Asset Affected',
      type: 'select',
      options: [
        'Hydro Power Plant',
        'Micro-Hydro Plant',
        '11kV / 33kV Distribution Line & Poles',
        'Distribution Transformer / Mini-Grid',
      ],
      required: false,
    },
    {
      id: 'q-eng-outage',
      label: 'Power Supply Disrupted?',
      type: 'yesno',
      required: false,
    },
    {
      id: 'q-eng-capacity',
      label: 'Affected Generation Capacity (kW / MW) or Remarks',
      type: 'text',
      required: false,
    },
  ],
  'Public Buildings': [
    {
      id: 'q-bld-type',
      label: 'Government / Public Facility Type',
      type: 'select',
      options: [
        'Ward / Palika Office',
        'District / Provincial Govt Office',
        'Police / Security Post',
        'Community Shelter / Hall',
      ],
      required: false,
    },
    {
      id: 'q-bld-safe',
      label: 'Structural Safety Inspection Required?',
      type: 'yesno',
      required: false,
    },
    {
      id: 'q-bld-service',
      label: 'Public Service Delivery Disrupted?',
      type: 'yesno',
      required: false,
    },
  ],
  Other: [
    {
      id: 'q-oth-desc',
      label: 'Specify Damaged Asset / Livelihood Category',
      type: 'text',
      required: false,
    },
    {
      id: 'q-oth-urgent',
      label: 'Immediate Emergency Intervention Required?',
      type: 'yesno',
      required: false,
    },
  ],
};

export const DEFAULT_STANDARDS: DamageStandard[] = [
  {
    id: 'STD-1',
    code: 'DMG-HSG-05',
    sector: 'Housing & Shelter',
    name: 'Private Housing Fully Damaged (Grade 5)',
    severity: 'Catastrophic',
    unit: 'Houses',
    unitCost: 500000,
    criteria:
      'Load-bearing walls collapsed >75% or foundation washed out; uninhabitable requiring full reconstruction.',
  },
  {
    id: 'STD-2',
    code: 'DMG-HSG-03',
    sector: 'Housing & Shelter',
    name: 'Private Housing Partially Damaged (Grade 3)',
    severity: 'Moderate',
    unit: 'Houses',
    unitCost: 150000,
    criteria:
      'Roofing blown off, non-structural cracks, or inundation wall damage; repairable without full demolition.',
  },
  {
    id: 'STD-4',
    code: 'DMG-BRG-01',
    sector: 'Roads & Bridges',
    name: 'Motorable Bridge Damaged',
    severity: 'Catastrophic',
    unit: 'Bridges',
    unitCost: 15000000,
    criteria:
      'RCC/steel motorable bridge abutment scouring, pier settlement, or deck collapse cutting vehicular access.',
  },
  {
    id: 'STD-8',
    code: 'DMG-BRG-02',
    sector: 'Roads & Bridges',
    name: 'Bailey Bridge (BelliBridge) Damaged',
    severity: 'Catastrophic',
    unit: 'Bridges',
    unitCost: 8500000,
    criteria:
      'Modular Bailey bridge truss panel buckling, abutment washout, or approach slab collapse.',
  },
  {
    id: 'STD-9',
    code: 'DMG-BRG-03',
    sector: 'Roads & Bridges',
    name: 'Suspension / Trail Bridge Damaged',
    severity: 'Severe',
    unit: 'Bridges',
    unitCost: 3500000,
    criteria:
      'Main cable loosening, tower foundation erosion, or walkway deck washout rendering crossing unsafe.',
  },
  {
    id: 'STD-3',
    code: 'DMG-RDS-01',
    sector: 'Roads & Bridges',
    name: 'Motorable Road Washout / Landslide Block',
    severity: 'Severe',
    unit: 'Meters',
    unitCost: 85000,
    criteria:
      'Complete scouring of road formation, retaining wall failure, or carriageway cut off requiring gabion/excavation.',
  },
  {
    id: 'STD-10',
    code: 'DMG-LVS-01',
    sector: 'Agriculture & Livestock',
    name: 'Cattle / Large Livestock Death',
    severity: 'Severe',
    unit: 'Head',
    unitCost: 85000,
    criteria:
      'Mortality of cow, buffalo, ox, or goat/sheep due to flood, landslide, collapse, or lightning.',
  },
  {
    id: 'STD-11',
    code: 'DMG-LVS-02',
    sector: 'Agriculture & Livestock',
    name: 'Cattle Shed Damaged',
    severity: 'Moderate',
    unit: 'Sheds',
    unitCost: 75000,
    criteria:
      'Structural collapse or washout of livestock shelter / goth requiring reconstruction.',
  },
  {
    id: 'STD-12',
    code: 'DMG-LVS-03',
    sector: 'Agriculture & Livestock',
    name: 'Poultry Loss / Farm Damaged',
    severity: 'Moderate',
    unit: 'Units',
    unitCost: 1200,
    criteria:
      'Poultry bird mortality or coop/brooder inundation from floodwater or storm.',
  },
  {
    id: 'STD-6',
    code: 'DMG-AGR-01',
    sector: 'Agriculture & Livestock',
    name: 'Irrigated Crop Land Silting / Washout',
    severity: 'Moderate',
    unit: 'Hectares',
    unitCost: 180000,
    criteria:
      'Standing paddy/maize submerged or covered by >15cm sand/debris from flood.',
  },
  {
    id: 'STD-7',
    code: 'DMG-EDU-01',
    sector: 'Education',
    name: 'School Building / Classroom Damaged',
    severity: 'Severe',
    unit: 'Schools',
    unitCost: 2500000,
    criteria:
      'Roof truss failure, flooded classrooms, boundary wall collapse, or furniture/lab destruction halting classes.',
  },
  {
    id: 'STD-13',
    code: 'DMG-PUB-01',
    sector: 'Public Buildings',
    name: 'Government Office Building Damaged',
    severity: 'Severe',
    unit: 'Offices',
    unitCost: 3000000,
    criteria:
      'Structural or inundation damage to ward office, municipal building, or line-agency office disrupting public services.',
  },
  {
    id: 'STD-14',
    code: 'DMG-ENG-01',
    sector: 'Energy & Power',
    name: 'Hydro Power / Micro-Hydro Plant Damaged',
    severity: 'Catastrophic',
    unit: 'Plants',
    unitCost: 12000000,
    criteria:
      'Intake weir washout, headrace/penstock rupture, or powerhouse flooding halting electricity generation.',
  },
  {
    id: 'STD-5',
    code: 'DMG-WSH-01',
    sector: 'Water & Sanitation (WASH)',
    name: 'Drinking Water Intake & Pipeline Rupture',
    severity: 'Severe',
    unit: 'Schemes',
    unitCost: 650000,
    criteria:
      'Source intake buried or HDPE transmission line washed away disrupting ward water supply.',
  },
  {
    id: 'STD-15',
    code: 'DMG-OTH-01',
    sector: 'Other',
    name: 'Other Infrastructure / Community Asset Loss',
    severity: 'Moderate',
    unit: 'Units',
    unitCost: 50000,
    criteria:
      'Community asset, small enterprise, warehouse, or miscellaneous public/private property loss.',
  },
];

export interface ReliefItemPreset {
  name: string;
  unit: string;
  defaultNote?: string;
}

export const DEFAULT_RELIEF_ITEMS: ReliefItemPreset[] = [
  { name: 'Tent', unit: 'Pcs' },
  { name: 'Mattress', unit: 'Pcs' },
  { name: 'Tarpaulin', unit: 'Pcs' },
  { name: 'Rice', unit: 'kg' },
  { name: 'Salt', unit: 'kg' },
  { name: 'Potato', unit: 'kg' },
  { name: 'Cooking Oil', unit: 'Liters' },
  { name: 'Beans / Pulses', unit: 'kg' },
  { name: 'Lentils (Dal)', unit: 'kg' },
  { name: 'Turmeric', unit: 'kg', defaultNote: '500g per pack' },
  { name: 'Health / Hygiene Kit', unit: 'Kits' },
  { name: 'Blanket', unit: 'Pcs' },
];

export const RELIEF_UNITS: string[] = [
  'Pcs',
  'kg',
  'Liters',
  'Kits',
  'Packets',
  'Sacks',
  'Sets',
  'Boxes',
  'Units',
];

export const DEFAULT_ENTRIES: DamageEntry[] = [];
