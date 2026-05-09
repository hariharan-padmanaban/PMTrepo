/**
 * Enjaz shared form + button class names. Styles live in `index.css` (@layer components).
 * Use these so dropdowns, inputs, date fields, and buttons share one height (36px) and the same
 * focus/hover effects across screens.
 */
export const enj = {
  control: 'enj-control',
  /** Multiline: same focus/border as inputs, not fixed 36px height. */
  textarea: 'enj-textarea',
  /** Base button — pair with a variant. */
  btn: 'enj-btn',
  btnDefault: 'enj-btn enj-btn-default',
  btnPrimary: 'enj-btn enj-btn-primary',
  btnOutline: 'enj-btn enj-btn-outline',
  btnGhost: 'enj-btn enj-btn-ghost',
  btnDanger: 'enj-btn enj-btn-danger',

  /** App shell: main content area horizontal padding. */
  main: 'enj-app-main',
  /** Vertical section rhythm (stacks of cards/sections). */
  stack: 'enj-stack',
  /** Page title (H1) — Manrope, brand navy. */
  pageTitle: 'enj-page-title',
  /** Section / card title (H2). */
  sectionTitle: 'enj-section-title',
  /** Subhead (H3, panel titles). */
  subhead: 'enj-subhead',
  /** Form and filter labels. */
  label: 'enj-label',
  /** Muted one-line body / helper. */
  caption: 'enj-caption',
  /** Primary body copy in panels. */
  body: 'enj-body',
  /** Validation / field error. */
  fieldError: 'enj-field-error',
  /** Standard elevated surface. */
  card: 'enj-card',
  cardPad: 'enj-card-pad',
  /** Data tables (shared header/row zebra; `--brand` matches base styling). */
  table: 'enj-table',
  tableBrand: 'enj-table enj-table--brand',
  /** Clickable primary name / link column (TableDesign.md). */
  tableLink: 'enj-table-link',
  /** SVG chart block — consistent min height, responsive. */
  chartSvg: 'enj-chart-svg chart-svg',
  /** Small chart (h-32) for sidebar widgets. */
  chartSvgSm: 'enj-chart-svg--sm chart-svg',
  /** Large chart (h-72) for dashboard main charts. */
  chartSvgLg: 'enj-chart-svg--lg chart-svg',

  // Badges (rounded-full, text-[10px])
  badge:        'enj-badge',
  badgeSuccess: 'enj-badge enj-badge-success',
  badgeDanger:  'enj-badge enj-badge-danger',
  badgeWarning: 'enj-badge enj-badge-warning',
  badgeInfo:    'enj-badge enj-badge-info',
  badgeNeutral: 'enj-badge enj-badge-neutral',

  // Pills (rounded-md, text-xs) for sprint/task status
  pill:        'enj-pill',
  pillSuccess: 'enj-pill enj-pill-success',
  pillWarning: 'enj-pill enj-pill-warning',
  pillDanger:  'enj-pill enj-pill-danger',
  pillNeutral: 'enj-pill enj-pill-neutral',

  /** Tinted section panel background. */
  panelBg: 'enj-panel-bg',

  /** Standardized screen container. */
  screenContainer: 'enj-screen-container',
  screenSection: 'enj-screen-section',
  screenSectionFullHeight: 'enj-screen-section-fullheight',
} as const;
