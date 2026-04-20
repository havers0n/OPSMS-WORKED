// Warehouse layout data
// Coordinates are in "map units" — 1 unit ~= 10cm visual scale
// World bounds: 0,0 to 1400, 900

const STATUSES = {
  free:      { id: 'free',      label: 'Свободно',     labelEn: 'Free',      fill: 'var(--s-free)',      stroke: 'var(--s-free-line)',      dashed: true  },
  partial:   { id: 'partial',   label: 'Частично',     labelEn: 'Partial',   fill: 'var(--s-partial)',   stroke: 'var(--s-partial-line)',   dashed: false },
  full:      { id: 'full',      label: 'Заполнено',    labelEn: 'Full',      fill: 'var(--s-full)',      stroke: 'var(--s-full-line)',      dashed: false },
  reserved:  { id: 'reserved',  label: 'Зарезерв.',    labelEn: 'Reserved',  fill: 'var(--s-reserved)',  stroke: 'var(--s-reserved-line)',  dashed: false, pattern: 'reserve' },
  inventory: { id: 'inventory', label: 'Инвентариз.',  labelEn: 'Inventory', fill: 'var(--s-inventory)', stroke: 'var(--s-inventory-line)', dashed: false, pattern: 'invent' },
  blocked:   { id: 'blocked',   label: 'Блокировано',  labelEn: 'Blocked',   fill: 'var(--s-blocked)',   stroke: 'var(--s-blocked-line)',   dashed: false, pattern: 'block' },
};

// Zones — big translucent rectangles with watermark text
const ZONES = [
  { id: 'Z-RCV', name: 'ПРИЁМКА',   nameEn: 'Receiving', x: 40,   y: 40,  w: 260, h: 220, color: 'var(--zone-receive)' },
  { id: 'Z-STG', name: 'КОМПЛЕКТ.', nameEn: 'Staging',   x: 40,   y: 640, w: 260, h: 220, color: 'var(--zone-stage)' },
  { id: 'Z-SHP', name: 'ОТГРУЗКА',  nameEn: 'Shipping',  x: 1100, y: 640, w: 260, h: 220, color: 'var(--zone-ship)' },
  { id: 'Z-DEF', name: 'БРАК',      nameEn: 'Defect',    x: 1100, y: 40,  w: 260, h: 180, color: 'var(--zone-defect)' },
];

// Walls and columns (top-down)
const WALLS = [
  // perimeter broken into segments
  { x: 20, y: 20, w: 1360, h: 8 },   // top
  { x: 20, y: 872, w: 1360, h: 8 },  // bottom
  { x: 20, y: 20, w: 8, h: 860 },    // left
  { x: 1372, y: 20, w: 8, h: 860 },  // right
];

const COLUMNS = [
  { x: 350, y: 300, s: 18 },
  { x: 700, y: 300, s: 18 },
  { x: 1050, y: 300, s: 18 },
  { x: 350, y: 580, s: 18 },
  { x: 700, y: 580, s: 18 },
  { x: 1050, y: 580, s: 18 },
];

// Dock doors (on walls)
const DOORS = [
  { x: 60,   y: 16, w: 80, h: 16, label: 'D1' },
  { x: 180,  y: 16, w: 80, h: 16, label: 'D2' },
  { x: 1140, y: 864, w: 80, h: 16, label: 'D5' },
  { x: 1260, y: 864, w: 80, h: 16, label: 'D6' },
];

// Floor-pallet cells (in staging zone)
const FLOOR_CELLS = (() => {
  const cells = [];
  const originX = 60, originY = 680;
  const cols = 5, rows = 3;
  const cw = 36, ch = 44, gap = 4;
  const statuses = ['full','full','partial','full','free','partial','full','full','free','free','partial','full','full','full','full'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        id: `PAL-${String.fromCharCode(65 + r)}${c + 1}`,
        x: originX + c * (cw + gap),
        y: originY + r * (ch + gap),
        w: cw, h: ch,
        status: statuses[r * cols + c] || 'free',
      });
    }
  }
  return cells;
})();

// Racks — each rack has N sections along its length
// Layout: 4 aisles of racks, double-sided rows
function buildRacks() {
  const racks = [];
  // Row configurations: each "row" is a pair of back-to-back racks
  // letters A..L for rack identity
  const rowYs = [
    { y: 300, letters: ['A','B'], pair: true },   // top row pair
    { y: 420, letters: ['C','D'], pair: true },   // mid-top pair
    { y: 540, letters: ['E','F'], pair: true },   // mid-bottom pair
  ];
  const rackStartX = 360;
  const rackLength = 660; // along x
  const sectionsPerRack = 11;
  const rackDepth = 32;

  rowYs.forEach((row, rowIdx) => {
    row.letters.forEach((letter, li) => {
      const y = row.y + (li === 0 ? -rackDepth : 0); // back-to-back with 0 gap? add small gap
      const actualY = row.y + (li === 0 ? -rackDepth - 2 : 2);
      const rack = {
        id: letter,
        x: rackStartX,
        y: actualY,
        w: rackLength,
        h: rackDepth,
        sections: [],
        labelPos: li === 0 ? 'top' : 'bottom',
      };
      for (let s = 0; s < sectionsPerRack; s++) {
        const sw = rackLength / sectionsPerRack;
        // pseudo-random but stable status
        const key = letter.charCodeAt(0) * 13 + s * 7 + rowIdx * 3;
        const r = Math.abs(Math.sin(key) * 100000) % 100;
        let status;
        if (s === 2 && letter === 'A') status = 'blocked';
        else if (s === 5 && letter === 'C') status = 'inventory';
        else if (s === 8 && letter === 'D') status = 'reserved';
        else if (s === 0 && letter === 'F') status = 'blocked';
        else if (r < 18) status = 'free';
        else if (r < 40) status = 'partial';
        else if (r < 90) status = 'full';
        else status = 'reserved';

        const fill = Math.max(0, Math.min(100, Math.round(
          status === 'free' ? 0 :
          status === 'partial' ? 25 + (r % 50) :
          status === 'full' ? 88 + (r % 12) :
          status === 'reserved' ? 60 + (r % 30) :
          status === 'inventory' ? 40 + (r % 50) :
          status === 'blocked' ? (r % 100) : 50
        )));

        rack.sections.push({
          id: `${letter}-${String(s + 1).padStart(2, '0')}`,
          rackId: letter,
          x: rackStartX + s * sw,
          y: actualY,
          w: sw,
          h: rackDepth,
          status,
          fill,
          tiers: 4,
        });
      }
      racks.push(rack);
    });
  });
  return racks;
}

const RACKS = buildRacks();

// Ruler grid lines
const RULER = {
  xLabels: (() => {
    // A..L along the rack length, every ~60 units
    const labels = [];
    const startX = 360;
    const step = 60;
    for (let i = 0; i < 11; i++) {
      labels.push({ x: startX + i * step + step / 2, label: String(i + 1).padStart(2, '0') });
    }
    return labels;
  })(),
  yLabels: [
    { y: 285, label: 'A' },
    { y: 317, label: 'B' },
    { y: 405, label: 'C' },
    { y: 437, label: 'D' },
    { y: 525, label: 'E' },
    { y: 557, label: 'F' },
  ],
};

const WORLD = { x: 0, y: 0, w: 1400, h: 900 };

window.WMS = { STATUSES, ZONES, WALLS, COLUMNS, DOORS, FLOOR_CELLS, RACKS, RULER, WORLD };
