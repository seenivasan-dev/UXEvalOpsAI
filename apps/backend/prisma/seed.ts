import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const jobs = [
    {
      imageFileName: 'sample-dashboard.jpg',
      imageBase64: '',
      status: 'completed',
      overallScore: 72,
      grade: 'C',
      summary:
        'The dashboard has acceptable visual hierarchy but significant accessibility gaps, including low contrast ratios on secondary text and missing ARIA labels on interactive controls. Copy is mostly clear with minor tone inconsistencies.',
      topIssues: [
        'Color contrast ratio fails WCAG AA on secondary text',
        'CTA buttons lack sufficient visual prominence',
        'Form inputs missing associated label elements',
      ],
      durationSeconds: 11.4,
      agentResults: {
        create: [
          {
            agentName: 'Visual Hierarchy',
            score: 78,
            status: 'good',
            findings: [
              { severity: 'medium', title: 'CTA lacks prominence', detail: 'Primary action button does not stand out from surrounding content' },
              { severity: 'low', title: 'Whitespace imbalance', detail: 'Excessive padding on left panel reduces content density' },
            ],
            recommendation: 'Increase CTA button size and apply stronger color contrast to separate it from secondary actions.',
            reflected: false,
            durationMs: 2840,
          },
          {
            agentName: 'Accessibility',
            score: 61,
            status: 'warning',
            findings: [
              { severity: 'high', title: 'Low contrast ratio', detail: 'Secondary text #999 on white fails WCAG AA 4.5:1 requirement' },
              { severity: 'high', title: 'Missing form labels', detail: 'Search input has placeholder but no associated label element' },
            ],
            recommendation: 'Update secondary text color to #767676 minimum and add explicit label elements to all form controls.',
            reflected: true,
            durationMs: 5120,
          },
          {
            agentName: 'Copy and Tone',
            score: 80,
            status: 'good',
            findings: [
              { severity: 'low', title: 'Inconsistent button copy', detail: '"Submit" and "Go" used interchangeably for same action type' },
            ],
            recommendation: 'Standardize action verb usage across all CTAs — prefer "Submit" for form actions.',
            reflected: false,
            durationMs: 2210,
          },
          {
            agentName: 'Design Consistency',
            score: 70,
            status: 'good',
            findings: [
              { severity: 'medium', title: 'Spacing inconsistency', detail: 'Card padding alternates between 16px and 24px with no clear pattern' },
              { severity: 'low', title: 'Icon style mismatch', detail: 'Outline icons mixed with filled icons in same navigation bar' },
            ],
            recommendation: 'Establish a spacing scale (4/8/16/24/32px) and enforce consistent icon style throughout.',
            reflected: false,
            durationMs: 2630,
          },
        ],
      },
      telemetry: {
        create: [
          { event: 'evaluation.created', metadata: { fileName: 'sample-dashboard.jpg' } },
          { event: 'evaluation.completed', metadata: { score: 72, grade: 'C', durationSeconds: 11.4 } },
        ],
      },
    },
    {
      imageFileName: 'checkout-flow.png',
      imageBase64: '',
      status: 'completed',
      overallScore: 55,
      grade: 'F',
      summary:
        'Critical accessibility failures throughout the checkout flow. Touch targets are undersized on mobile, error states are communicated by color alone, and the visual hierarchy does not guide users through the multi-step process effectively.',
      topIssues: [
        'Touch targets below 44x44px minimum on mobile',
        'Error states rely on color alone — no icon or text indicator',
        'Step progress indicator is not screen-reader accessible',
      ],
      durationSeconds: 13.2,
      agentResults: {
        create: [
          {
            agentName: 'Visual Hierarchy',
            score: 60,
            status: 'warning',
            findings: [
              { severity: 'high', title: 'No clear step indicator', detail: 'Multi-step checkout has no visible progress indicator' },
              { severity: 'medium', title: 'F-pattern disrupted', detail: 'Important fields placed in bottom-right — low visual attention zone' },
            ],
            recommendation: 'Add a numbered step progress bar at the top of the checkout flow.',
            reflected: false,
            durationMs: 3100,
          },
          {
            agentName: 'Accessibility',
            score: 38,
            status: 'critical',
            findings: [
              { severity: 'high', title: 'Touch targets too small', detail: 'Checkbox and radio inputs are 16x16px — below 44x44px minimum' },
              { severity: 'high', title: 'Color-only error state', detail: 'Validation errors shown only with red border — no text or icon' },
              { severity: 'high', title: 'No ARIA live region', detail: 'Dynamic error messages not announced to screen readers' },
            ],
            recommendation: 'Increase touch targets to minimum 44x44px and add error text below each invalid field.',
            reflected: true,
            durationMs: 6400,
          },
          {
            agentName: 'Copy and Tone',
            score: 65,
            status: 'warning',
            findings: [
              { severity: 'medium', title: 'Anxiety-inducing copy', detail: '"Warning: Your session will expire" shown unnecessarily on entry' },
            ],
            recommendation: 'Remove premature session warnings — show only when session is actually close to expiring.',
            reflected: false,
            durationMs: 2180,
          },
          {
            agentName: 'Design Consistency',
            score: 57,
            status: 'warning',
            findings: [
              { severity: 'high', title: 'Button styles conflict', detail: 'Three different button border-radius values used: 4px, 8px, 50%' },
              { severity: 'medium', title: 'Typography scale broken', detail: 'H2 and H3 are same size — visual hierarchy collapses' },
            ],
            recommendation: 'Define a single border-radius token (8px) and enforce a distinct size for each heading level.',
            reflected: false,
            durationMs: 2900,
          },
        ],
      },
      telemetry: {
        create: [
          { event: 'evaluation.created', metadata: { fileName: 'checkout-flow.png' } },
          { event: 'evaluation.completed', metadata: { score: 55, grade: 'F', durationSeconds: 13.2 } },
        ],
      },
    },
    {
      imageFileName: 'settings-panel.webp',
      imageBase64: '',
      status: 'completed',
      overallScore: 88,
      grade: 'B',
      summary:
        'Settings panel demonstrates strong design consistency and clear visual hierarchy. Accessibility is well-implemented with proper label associations and adequate contrast. Minor copy improvements would elevate the experience further.',
      topIssues: [
        'Toggle labels could be more descriptive for screen readers',
        'Section grouping headings are visually subtle',
      ],
      durationSeconds: 9.7,
      agentResults: {
        create: [
          {
            agentName: 'Visual Hierarchy',
            score: 90,
            status: 'good',
            findings: [
              { severity: 'low', title: 'Section headings subtle', detail: 'Category headings blend with body text — insufficient weight contrast' },
            ],
            recommendation: 'Increase section heading font weight to 600 and add 4px bottom border for visual separation.',
            reflected: false,
            durationMs: 2500,
          },
          {
            agentName: 'Accessibility',
            score: 85,
            status: 'good',
            findings: [
              { severity: 'medium', title: 'Toggle ARIA labels generic', detail: 'Toggle switches use aria-label="Toggle" without describing what they control' },
            ],
            recommendation: 'Update toggle ARIA labels to describe the specific setting, e.g. aria-label="Toggle email notifications".',
            reflected: true,
            durationMs: 4800,
          },
          {
            agentName: 'Copy and Tone',
            score: 88,
            status: 'good',
            findings: [
              { severity: 'low', title: 'Passive voice in descriptions', detail: '"Notifications can be configured below" — prefer direct active voice' },
            ],
            recommendation: 'Rewrite setting descriptions in active voice: "Configure notifications below".',
            reflected: false,
            durationMs: 2000,
          },
          {
            agentName: 'Design Consistency',
            score: 89,
            status: 'good',
            findings: [
              { severity: 'low', title: 'Icon alignment off', detail: 'Two icons in danger zone section are 2px lower than surrounding text' },
            ],
            recommendation: 'Apply vertical-align: middle to all inline icons and audit alignment across sections.',
            reflected: false,
            durationMs: 2200,
          },
        ],
      },
      telemetry: {
        create: [
          { event: 'evaluation.created', metadata: { fileName: 'settings-panel.webp' } },
          { event: 'evaluation.completed', metadata: { score: 88, grade: 'B', durationSeconds: 9.7 } },
        ],
      },
    },
  ]

  for (const job of jobs) {
    await prisma.evaluationJob.create({ data: job })
  }

  console.log(`Seeded ${jobs.length} evaluation jobs with agent results and telemetry.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
