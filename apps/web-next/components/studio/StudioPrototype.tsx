'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import ClientPlot from '@/components/ClientPlot'
import { calculateMetric, formatMetric, metricDefinitions, metricLabel } from '@/lib/analysis/metrics'
import type { ComparisonDimension, MetricKey } from '@/lib/analysis/types'
import { demographicDimensionDefinitions, demographicDimensionLabel, type DemographicDimension } from '@/lib/dataset/types'
import type { PublicDemoAgentActivityKey } from '@/lib/dataset/public-demo-identities'
import { comparisonLabel, buildPlotlyModel } from '@/lib/visualization/plotly-model'
import { isChartAllowed } from '@/lib/visualization/chart-policy'
import type { ChartType } from '@/lib/workspace/types'
import {
  StudioWorkspaceProvider,
  useStudioWorkspace,
} from './StudioWorkspaceProvider'

type DemoAgentAction =
  | 'seniority'
  | 'product-ad-set-compare'
  | 'product-campaign-compare'
  | 'daily-trend'
  | 'high-cpa'
  | 'reset'

const comparisonOptions: Array<{ value: ComparisonDimension; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'product_ad_set', label: 'Product Ad Set' },
  { value: 'product_campaign', label: 'Product Campaign' },
  { value: 'time', label: 'Time' },
]

const agentActions: Array<{ value: DemoAgentAction; label: string }> = [
  { value: 'seniority', label: 'Switch to seniority' },
  { value: 'product-ad-set-compare', label: 'Compare Product Ad Sets' },
  { value: 'product-campaign-compare', label: 'Compare Product Campaigns' },
  { value: 'daily-trend', label: 'Show the daily trend' },
  { value: 'high-cpa', label: 'Highlight the highest CPA value' },
  { value: 'reset', label: 'Reset the exploration' },
]

const selectClass =
  'mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100'
const fieldLabelClass = 'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'

export default function StudioPrototype() {
  return (
    <StudioWorkspaceProvider>
      <StudioWorkspace />
    </StudioWorkspaceProvider>
  )
}

function StudioWorkspace() {
  const {
    dataset,
    state,
    capabilities,
    activeResult,
    rangeResult,
    availableFrames,
  } = useStudioWorkspace()
  const [selectedAgentAction, setSelectedAgentAction] =
    useState<DemoAgentAction>('product-ad-set-compare')

  const productCampaigns = state.dataset.productCampaigns
  const productAdSets = useMemo(
    () => state.dataset.productAdSets.filter((adSet) =>
      state.selection.filters.productCampaignId === 'all' ||
      adSet.productCampaignId === state.selection.filters.productCampaignId
    ),
    [state.dataset.productAdSets, state.selection.filters.productCampaignId]
  )

  const selectedProductCampaign = productCampaigns.find(
    (campaign) => campaign.id === state.selection.filters.productCampaignId
  )
  const selectedProductAdSet = productAdSets.find(
    (adSet) => adSet.id === state.selection.filters.productAdSetId
  )

  const activeSuccess = activeResult.ok ? activeResult : null
  const rangeSuccess = rangeResult.ok ? rangeResult : null
  const plot = activeSuccess ? buildPlotlyModel(activeSuccess, state) : null
  const currentMetricValue = activeSuccess
    ? calculateMetric(activeSuccess.totals, state.analysis.metric)
    : null
  const conversionsValue = activeSuccess
    ? calculateMetric(activeSuccess.totals, 'conversions')
    : null
  const highCpaFinding = rangeSuccess && state.analysis.metric === 'cpa'
    ? [...rangeSuccess.cells]
        .filter((cell) => cell.value !== null)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
    : null

  const executeAgentAction = () => {
    const context = (activityKey: PublicDemoAgentActivityKey) => ({
      actor: 'agent' as const,
      activityKey,
    })
    switch (selectedAgentAction) {
      case 'seniority':
        capabilities.configureView({
          analysis: {
            demographicDimension: 'seniority',
            comparisonDimension: 'none',
            highlightMode: 'none',
          },
          visualization: { chartType: 'bar' },
          animation: { enabled: false, playing: false },
        }, context('switchSeniority'))
        break
      case 'product-ad-set-compare':
        capabilities.configureView({
          analysis: { comparisonDimension: 'product_ad_set', highlightMode: 'none' },
          visualization: { chartType: 'bar' },
          animation: { enabled: false, playing: false },
        }, context('compareProductAdSets'))
        break
      case 'product-campaign-compare':
        capabilities.configureView({
          analysis: { comparisonDimension: 'product_campaign', highlightMode: 'none' },
          visualization: { chartType: 'heatmap' },
          animation: { enabled: false, playing: false },
        }, context('compareProductCampaigns'))
        break
      case 'daily-trend':
        capabilities.configureView({
          analysis: { comparisonDimension: 'time', highlightMode: 'none' },
          visualization: { chartType: 'line' },
          animation: {
            enabled: true,
            playing: true,
            currentFrame: availableFrames[0],
          },
        }, context('dailyTrend'))
        break
      case 'high-cpa':
        capabilities.configureView({
          analysis: {
            metric: 'cpa',
            comparisonDimension: 'none',
            highlightMode: 'high-cpa',
          },
          visualization: { chartType: 'bar' },
          animation: { enabled: false, playing: false },
        }, context('highlightHighCpa'))
        break
      case 'reset':
        capabilities.resetView(context('reset'))
    }
  }

  return (
    <main className="studio-shell min-h-screen text-slate-900">
      <header className="studio-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <div className="studio-logo" aria-hidden="true">M</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-950">Median Viz Studio</h1>
              <span className="prototype-pill">Slice 5</span>
            </div>
            <p className="truncate text-xs text-slate-500">{dataset.disclosure}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
            <span className="mr-1.5 mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" /> Agent ready
          </span>
          <Link href="/" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Gallery</Link>
        </div>
      </header>

      <div className="studio-grid">
        <aside className="studio-panel studio-data-panel order-2 xl:order-1" aria-label="Dataset overview">
          <div className="panel-eyebrow">Data contract</div>
          <h2 className="mt-2 text-lg font-bold text-slate-950">LinkedIn daily demographics</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">Representative {dataset.client.name} demo data adapted into the canonical Studio dataset.</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <StatTile label="Rows" value={dataset.rows.length.toLocaleString()} tone="lavender" />
            <StatTile label="Days" value={availableDateCount(dataset.window.startDate, dataset.window.endDate).toString()} tone="mint" />
            <StatTile label="B2B pivots" value={demographicDimensionDefinitions.length.toString()} tone="peach" />
            <StatTile label="Measures" value={metricDefinitions.length.toString()} tone="blue" />
          </div>

          <div className="mt-6">
            <h3 className={fieldLabelClass}>Independent pivots</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {demographicDimensionDefinitions.map((dimension) => (
                <span key={dimension.key} className="field-chip">{dimension.label}</span>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">✓</span>
              Shared workspace ready
            </div>
            <p className="mt-1.5 text-xs leading-5 text-emerald-700">Dataset adapter → analysis query → capabilities → visualization.</p>
          </div>

          <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs">
            <ContractRow label="Window" value={`${dataset.window.startDate} → ${dataset.window.endDate}`} />
            <ContractRow label="Source type" value={dataset.sourceType} />
            <ContractRow label="Product Campaign" value="Product grouping" />
            <ContractRow label="Product Ad Set" value="Analytical subject" />
            <ContractRow label="LinkedIn source Campaign" value="sponsoredCampaign · CAMPAIGN" />
            <ContractRow label="Query guard" value="Exactly 1 demographic pivot" />
          </dl>

          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-3.5 text-xs leading-5 text-amber-800">
            <div className="font-bold">Data-quality semantics</div>
            <p className="mt-1">Privacy adjusted · status-only evidence preserved · unresolved labels retained.</p>
          </div>
        </aside>

        <section className="order-1 min-w-0 xl:order-2" aria-label="Visualization workspace">
          <div className="active-view-bar">
            <div className="min-w-0">
              <div className="panel-eyebrow">Active pivot</div>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                {metricLabel(state.analysis.metric)} by {demographicDimensionLabel(state.analysis.demographicDimension)}
                {state.analysis.comparisonDimension !== 'none'
                  ? ` · compare ${comparisonLabel(state.analysis.comparisonDimension)}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {selectedProductCampaign && <FilterPill label={selectedProductCampaign.name} />}
              {selectedProductAdSet && <FilterPill label={selectedProductAdSet.name} />}
              {!selectedProductCampaign && !selectedProductAdSet && (
                <span className="text-xs text-slate-400">All Product Campaigns and Product Ad Sets</span>
              )}
            </div>
          </div>

          <div className="studio-canvas mt-3">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">Delivered audience</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                  {demographicDimensionLabel(state.analysis.demographicDimension)} performance
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeSuccess?.rows.length.toLocaleString() ?? 0} independent pivot evidence records selected
                </p>
                {activeSuccess && (
                  <p className="mt-1 text-xs text-slate-400">
                    {activeSuccess.quality.metricObservationCount} metric observations · {activeSuccess.quality.statusOnlyEvidenceCount} status-only · {activeSuccess.quality.unresolvedLabelCount} unresolved labels
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <KpiChip label={metricLabel(state.analysis.metric)} value={formatMetric(currentMetricValue, state.analysis.metric, true)} />
                <KpiChip label="Conversions" value={formatMetric(conversionsValue, 'conversions', true)} />
              </div>
            </div>

            {!activeResult.ok ? (
              <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
                <div className="font-bold">{activeResult.error.code}</div>
                <p className="mt-1">{activeResult.error.message}</p>
              </div>
            ) : !activeResult.metricAvailability.available ? (
              <UnavailablePanel reason={availabilityReasonLabel(activeResult.metricAvailability.unavailableReason)} />
            ) : plot ? (
              <ClientPlot
                data={plot.data}
                layout={plot.layout}
                config={{ displayModeBar: false, responsive: true }}
                height="clamp(370px, 52vh, 590px)"
                className="studio-plot"
              />
            ) : null}

            {activeSuccess && !activeSuccess.metricAvailability.available && (
              <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 sm:mx-6">
                {metricLabel(state.analysis.metric)} is supported but unavailable: {availabilityReasonLabel(activeSuccess.metricAvailability.unavailableReason)}.
              </div>
            )}

            <div className="border-t border-slate-100 px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className={`animation-button ${state.animation.enabled ? 'animation-button-active' : ''}`}
                  onClick={() => capabilities.setAnimation({
                    enabled: !state.animation.enabled,
                    playing: false,
                    currentFrame: availableFrames[0],
                  })}
                >
                  {state.animation.enabled ? 'Daily animation on' : 'Animate by day'}
                </button>
                {state.animation.enabled && (
                  <>
                    <button
                      type="button"
                      className="play-button"
                      aria-label={state.animation.playing ? 'Pause animation' : 'Play animation'}
                      onClick={() => capabilities.setAnimation({ playing: !state.animation.playing })}
                    >
                      {state.animation.playing ? 'Ⅱ' : '▶'}
                    </button>
                    <input
                      aria-label="Animation date"
                      type="range"
                      min={0}
                      max={Math.max(0, availableFrames.length - 1)}
                      value={Math.max(0, availableFrames.indexOf(state.animation.currentFrame))}
                      onChange={(event) => capabilities.setAnimation({
                        currentFrame: availableFrames[Number(event.target.value)],
                        playing: false,
                      })}
                      className="min-w-0 flex-1 accent-indigo-500"
                    />
                    <span className="w-24 text-right text-xs font-bold text-slate-600">
                      {state.animation.currentFrame}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {state.analysis.highlightMode === 'high-cpa' && highCpaFinding && (
            <div className="insight-card mt-3">
              <div className="insight-icon">↗</div>
              <div>
                <div className="panel-eyebrow text-pink-600">Agent highlight</div>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {highCpaFinding.demographicValue} has the highest available CPA inside the selected {demographicDimensionLabel(state.analysis.demographicDimension).toLowerCase()} pivot at {formatMetric(highCpaFinding.value, 'cpa')}.
                </p>
                <p className="mt-1 text-xs text-slate-500">This comparison stays inside one independent LinkedIn demographic dimension.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="studio-panel order-3" aria-label="Workspace controls and agent activity">
          <div className="panel-eyebrow">Visualize</div>
          <div className="mt-4 space-y-4">
            <ControlSelect
              label="Metric"
              value={state.analysis.metric}
              options={metricDefinitions.map((metric) => ({ value: metric.key, label: metric.label }))}
              onChange={(value) => capabilities.setMetric(value as MetricKey)}
            />
            <ControlSelect
              label="Demographic dimension"
              value={state.analysis.demographicDimension}
              options={demographicDimensionDefinitions.map((dimension) => ({ value: dimension.key, label: dimension.label }))}
              onChange={(value) => capabilities.setDemographicDimension(value as DemographicDimension)}
            />
            <ControlSelect
              label="Comparison dimension"
              value={state.analysis.comparisonDimension}
              options={comparisonOptions}
              onChange={(value) => capabilities.setComparisonDimension(value as ComparisonDimension)}
            />

            <div>
              <label className={fieldLabelClass}>Chart</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['bar', 'heatmap', 'line'] as ChartType[]).map((chartType) => {
                  const enabled = isChartAllowed(state.analysis.comparisonDimension, chartType)
                  return (
                    <button
                      key={chartType}
                      type="button"
                      disabled={!enabled}
                      className={`chart-choice ${state.visualization.chartType === chartType ? 'chart-choice-active' : ''} ${!enabled ? 'cursor-not-allowed opacity-35' : ''}`}
                      onClick={() => capabilities.setVisualization(chartType)}
                    >
                      <span aria-hidden="true">{chartType === 'bar' ? '▥' : chartType === 'heatmap' ? '▦' : '⌁'}</span>
                      {chartType}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
              <ControlSelect
                label="From"
                value={state.selection.startDate}
                options={availableDateOptions(dataset.window.startDate, dataset.window.endDate)}
                onChange={(value) => capabilities.setDateRange(value, state.selection.endDate)}
              />
              <ControlSelect
                label="To"
                value={state.selection.endDate}
                options={availableDateOptions(dataset.window.startDate, dataset.window.endDate)}
                onChange={(value) => capabilities.setDateRange(state.selection.startDate, value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-1">
              <ControlSelect
                label="Product Campaign filter"
                value={state.selection.filters.productCampaignId}
                options={[{ value: 'all', label: 'All Product Campaigns' }, ...productCampaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))]}
                onChange={(value) => capabilities.applyFilter('productCampaignId', value)}
              />
              <ControlSelect
                label="Product Ad Set filter"
                value={state.selection.filters.productAdSetId}
                options={[{ value: 'all', label: 'All Product Ad Sets' }, ...productAdSets.map((adSet) => ({ value: adSet.id, label: adSet.name }))]}
                onChange={(value) => capabilities.applyFilter('productAdSetId', value)}
              />
            </div>
          </div>

          <div className="agent-demo-card mt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="panel-eyebrow text-indigo-600">Demo agent actions</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Calls the same workspace capabilities as human controls.</p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">Simulated</span>
            </div>
            <select
              aria-label="Demo agent action"
              className={selectClass}
              value={selectedAgentAction}
              onChange={(event) => setSelectedAgentAction(event.target.value as DemoAgentAction)}
            >
              {agentActions.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
            </select>
            <button type="button" className="agent-run-button" onClick={executeAgentAction}>Run agent action</button>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <div className="panel-eyebrow">Agent activity</div>
              <span className="text-[10px] font-semibold text-slate-400">Revision {state.runtime.revision}</span>
            </div>
            <ol className="activity-rail mt-4">
              {state.story.agentActivity.map((activity, index) => (
                <li key={activity.id} className="activity-item">
                  <span className={`activity-dot ${index === 0 ? 'activity-dot-active' : ''}`} />
                  <div>
                    <p className="text-xs font-semibold leading-5 text-slate-700">{activity.label}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">Workspace revision {activity.revision}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </main>
  )
}

function availableDateOptions(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const options: Array<{ value: string; label: string }> = []
  for (let date = start; date <= end; date = new Date(date.getTime() + 86_400_000)) {
    const value = date.toISOString().slice(0, 10)
    options.push({ value, label: value })
  }
  return options
}

const availableDateCount = (startDate: string, endDate: string) =>
  availableDateOptions(startDate, endDate).length

function UnavailablePanel({ reason }: { reason: string }) {
  return (
    <div className="m-6 flex min-h-[330px] items-center justify-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl text-amber-600 shadow-sm">—</div>
        <h3 className="mt-3 text-base font-bold text-slate-800">Metric unavailable for this evidence</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{reason}. Status and data-quality evidence remain visible without inventing zero-valued bars.</p>
      </div>
    </div>
  )
}

function availabilityReasonLabel(reason: string | null) {
  switch (reason) {
    case 'no_metric_observations': return 'the selection contains status-only evidence and no metric observations'
    case 'no_conversions_for_derived_metric': return 'no conversions were observed in the selection'
    case 'no_clicks_for_derived_metric': return 'no clicks were observed in the selection'
    case 'no_impressions_for_derived_metric': return 'no impressions were observed in the selection'
    case 'metric_not_supported': return 'the dataset contract does not support this metric'
    default: return 'the selected evidence cannot produce this metric'
  }
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className={`stat-tile stat-${tone}`}><div className="text-lg font-extrabold text-slate-900">{value}</div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div></div>
}

function KpiChip({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[92px] rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-right"><div className="text-sm font-extrabold text-slate-900">{value}</div><div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</div></div>
}

function FilterPill({ label }: { label: string }) {
  return <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{label}</span>
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><dt className="text-slate-400">{label}</dt><dd className="text-right font-semibold text-slate-600">{value}</dd></div>
}

function ControlSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
