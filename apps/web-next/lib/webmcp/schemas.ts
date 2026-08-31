import { metricDefinitions } from '../analysis/metrics'
import {
  PUBLIC_DEMO_PRODUCT_AD_SETS,
  PUBLIC_DEMO_PRODUCT_CAMPAIGNS,
} from '../dataset/public-demo-identities'
import { demographicDimensionDefinitions } from '../dataset/types'

export const STUDIO_WEBMCP_READ_TOOL_NAMES = [
  'inspect_dataset',
  'get_workspace_state',
  'get_current_result_summary',
] as const

export const STUDIO_WEBMCP_MUTATION_TOOL_NAMES = [
  'configure_analysis',
  'apply_filters',
  'set_animation',
  'reset_view',
] as const

export const STUDIO_WEBMCP_TOOL_NAMES = [
  ...STUDIO_WEBMCP_READ_TOOL_NAMES,
  ...STUDIO_WEBMCP_MUTATION_TOOL_NAMES,
] as const

export type StudioWebMcpToolName = typeof STUDIO_WEBMCP_TOOL_NAMES[number]
export type StudioWebMcpInputSchema = Record<string, unknown>

export const noInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

const metricEnum = metricDefinitions.map((metric) => metric.key)
const demographicDimensionEnum = demographicDimensionDefinitions.map((dimension) => dimension.key)
const comparisonDimensionEnum = ['none', 'product_ad_set', 'product_campaign', 'time']
const visualizationEnum = ['bar', 'heatmap', 'line']
const campaignIdEnum = ['all', ...PUBLIC_DEMO_PRODUCT_CAMPAIGNS.map((campaign) => campaign.id)]
const adSetIdEnum = ['all', ...PUBLIC_DEMO_PRODUCT_AD_SETS.map((adSet) => adSet.productAdSetId)]
const reportDateEnum = Array.from({ length: 14 }, (_, index) =>
  `2026-08-${String(8 + index).padStart(2, '0')}`
)
const expectedRevision = {
  type: 'integer',
  minimum: 0,
  description: 'Optional optimistic concurrency guard. The mutation is rejected unless the workspace is still at this revision.',
}

export const studioWebMcpInputSchemas: Record<StudioWebMcpToolName, StudioWebMcpInputSchema> = {
  inspect_dataset: noInputSchema,
  get_workspace_state: noInputSchema,
  get_current_result_summary: noInputSchema,
  configure_analysis: {
    type: 'object',
    additionalProperties: false,
    properties: {
      metric: { type: 'string', enum: metricEnum },
      demographicDimension: {
        description: 'Select exactly one demographic pivot. A two-value array is accepted only so the capability can return the structured unsupported-intersection error.',
        oneOf: [
          { type: 'string', enum: demographicDimensionEnum },
          {
            type: 'array',
            items: { type: 'string', enum: demographicDimensionEnum },
            minItems: 2,
            maxItems: 2,
            uniqueItems: true,
          },
        ],
      },
      comparisonDimension: { type: 'string', enum: comparisonDimensionEnum },
      visualization: { type: 'string', enum: visualizationEnum },
      expectedRevision,
    },
    anyOf: [
      { required: ['metric'] },
      { required: ['demographicDimension'] },
      { required: ['comparisonDimension'] },
      { required: ['visualization'] },
    ],
  },
  apply_filters: {
    type: 'object',
    additionalProperties: false,
    required: ['mode'],
    properties: {
      mode: {
        type: 'string',
        const: 'replace',
        description: 'The workspace currently supports single-value filters, so supplied fields replace their current values.',
      },
      productCampaignId: { type: 'string', enum: campaignIdEnum },
      productAdSetId: { type: 'string', enum: adSetIdEnum },
      startDate: { type: 'string', enum: reportDateEnum },
      endDate: { type: 'string', enum: reportDateEnum },
      expectedRevision,
    },
    anyOf: [
      { required: ['productCampaignId'] },
      { required: ['productAdSetId'] },
      { required: ['startDate'] },
      { required: ['endDate'] },
    ],
  },
  set_animation: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mode: {
        type: 'string',
        enum: ['day_by_day', 'off'],
        description: 'day_by_day selects the supported time comparison and line visualization; off disables playback without changing the analytical selection.',
      },
      enabled: { type: 'boolean' },
      playing: { type: 'boolean' },
      currentFrame: { type: 'string', enum: reportDateEnum },
      expectedRevision,
    },
    anyOf: [
      { required: ['mode'] },
      { required: ['enabled'] },
      { required: ['playing'] },
      { required: ['currentFrame'] },
    ],
  },
  reset_view: {
    type: 'object',
    additionalProperties: false,
    properties: { expectedRevision },
  },
}

export const studioWebMcpToolMetadata: Record<StudioWebMcpToolName, {
  title: string
  description: string
}> = {
  inspect_dataset: {
    title: 'Inspect Studio dataset',
    description:
      'Use this to learn which demographics, comparisons, metrics, dates, and data-quality constraints the current Median Viz Studio demo supports. Returns bounded metadata only, never raw rows.',
  },
  get_workspace_state: {
    title: 'Get current Studio view',
    description:
      'Use this to understand exactly what the human is currently viewing in Median Viz Studio, including filters, metric, demographic pivot, comparison, chart, animation frame, availability, and relevant quality warnings.',
  },
  get_current_result_summary: {
    title: 'Summarize current Studio result',
    description:
      'Use this to answer questions about the analytical result currently visible in Median Viz Studio. Returns aggregate-safe totals and a deterministic bounded top-and-bottom segment summary; never raw fixture rows.',
  },
  configure_analysis: {
    title: 'Configure Studio analysis',
    description:
      'Change one or more supplied analysis settings in the visible Studio workspace: metric, one demographic pivot, comparison, or compatible visualization. Use expectedRevision when refining a view you previously inspected.',
  },
  apply_filters: {
    title: 'Apply Studio filters',
    description:
      'Replace supplied Product Campaign, Product Ad Set, or date-range filters in the visible Studio workspace using only the listed demo-safe values. Unspecified filters remain unchanged except that replacing Product Campaign clears Product Ad Set unless both are supplied.',
  },
  set_animation: {
    title: 'Configure Studio animation',
    description:
      'Configure the visible Studio day-by-day animation using the supported time comparison, playback state, and report-date frame. Use mode day_by_day to show and animate the daily trend.',
  },
  reset_view: {
    title: 'Reset Studio analysis',
    description:
      'Reset the visible Studio analysis, filters, visualization, and animation to the default view while preserving the loaded Northstar dataset.',
  },
}
