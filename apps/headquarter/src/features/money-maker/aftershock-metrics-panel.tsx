'use client'

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export interface PortfolioMetricDefinition {
  numerator: string
  denominator: string
  source: string
  interpretation: string
  currency: 'not-applicable' | 'product-count'
}

export interface PortfolioMetrics {
  window: {
    from: string
    to: string
    timezone: 'UTC'
    semantics: '[from, to)'
    outcomeCutoffExclusive: string
  }
  generatedAt: string
  freshness: {
    basis: 'arsy-postgresql-records'
    note: string
  }
  metricDefinitions: {
    opportunityPromotionRate: PortfolioMetricDefinition
    productPublicationCount: PortfolioMetricDefinition
    productFirstSaleRate: PortfolioMetricDefinition
    productRetirementCount: PortfolioMetricDefinition
    averageCompletedProductLifetimeSeconds: PortfolioMetricDefinition
  }
  opportunities: {
    createdCount: string
    promotedCount: string
    promotionNumerator: string
    promotionDenominator: string
    promotionRatePercent: string | null
  }
  products: {
    createdCount: string
    publishedCount: string
    firstSaleCount: string
    firstSaleNumerator: string
    firstSaleDenominator: string
    firstSaleRatePercent: string | null
    retiredCount: string
    averageCompletedLifetimeSeconds: string | null
  }
  unavailableMetrics: {
    discoveryToOpportunity: { available: false; reason: string }
    supportBurden: { available: false; reason: string }
  }
}

type Props = { metrics: PortfolioMetrics | null; loading: boolean }

function percent(value: string | null): string {
  return value === null ? '—' : value + '%'
}

function count(value: string): string {
  return /^\d+$/.test(value) ? value : '—'
}

function windowDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'invalid date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  }).format(date) + ' UTC'
}

function lifetime(value: string | null): string {
  if (value === null) return '—'
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return seconds.toFixed(2) + ' seconds'
  const minutes = seconds / 60
  if (minutes < 60) return minutes.toFixed(1) + ' minutes'
  const hours = minutes / 60
  if (hours < 48) return hours.toFixed(1) + ' hours'
  return (hours / 24).toFixed(1) + ' days'
}

function MetricTile({
  label, value, detail, testId,
}: { label: string; value: string; detail: string; testId: string }) {
  return (
    <article data-testid={testId} className="space-y-2 rounded border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-3xl tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </article>
  )
}

export function AftershockMetricsPanel({ metrics, loading }: Props) {
  if (!metrics) {
    return (
      <Card data-testid="aftershock-metrics">
        <CardHeader>
          <CardTitle>AFTERSHOCK · Portfolio learning</CardTitle>
          <CardDescription>Source-backed product outcomes, not market-demand estimates or revenue attribution.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">
            {loading ? 'Loading the ARSY reporting cohort…' : 'No portfolio metric response is available. Refresh the workspace or inspect the ARSY API error above.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const opportunityRateDetail = metrics.opportunities.promotionDenominator === '0'
    ? 'No eligible opportunity cohort'
    : metrics.opportunities.promotionNumerator + ' of ' + metrics.opportunities.promotionDenominator + ' opportunities'
  const firstSaleRateDetail = metrics.products.firstSaleDenominator === '0'
    ? 'No eligible product cohort'
    : metrics.products.firstSaleNumerator + ' of ' + metrics.products.firstSaleDenominator + ' created products'

  return (
    <Card data-testid="aftershock-metrics">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>AFTERSHOCK · Portfolio learning</CardTitle>
            <CardDescription>Verified product outcomes from persisted ARSY records. This is not an impression feed, revenue forecast or provider-sync claim.</CardDescription>
          </div>
          <Badge variant="outline">Source-backed · UTC</Badge>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>From {windowDate(metrics.window.from)}</span>
          <span>To (exclusive) {windowDate(metrics.window.to)}</span>
          <span>Computed {windowDate(metrics.generatedAt)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{metrics.freshness.note}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Opportunity promotion" value={percent(metrics.opportunities.promotionRatePercent)} detail={opportunityRateDetail} testId="aftershock-opportunity-promotion" />
          <MetricTile label="Product publication" value={count(metrics.products.publishedCount)} detail={count(metrics.products.publishedCount) + ' published products / ' + count(metrics.products.createdCount) + ' created'} testId="aftershock-product-publication" />
          <MetricTile label="Product first sale" value={percent(metrics.products.firstSaleRatePercent)} detail={firstSaleRateDetail} testId="aftershock-product-first-sale" />
          <MetricTile label="Product retirement" value={count(metrics.products.retiredCount)} detail={count(metrics.products.retiredCount) + ' audited retirements in the product cohort'} testId="aftershock-product-retirement" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed product lifetime</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{lifetime(metrics.products.averageCompletedLifetimeSeconds)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Mean creation-to-first-retirement time. Active products are right-censored and excluded.</p>
          </div>
          <div className="rounded border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cohort records</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Opportunities</dt><dd className="text-right tabular-nums">{count(metrics.opportunities.createdCount)}</dd>
              <dt className="text-muted-foreground">Promoted</dt><dd className="text-right tabular-nums">{count(metrics.opportunities.promotedCount)}</dd>
              <dt className="text-muted-foreground">Products</dt><dd className="text-right tabular-nums">{count(metrics.products.createdCount)}</dd>
              <dt className="text-muted-foreground">First sale</dt><dd className="text-right tabular-nums">{count(metrics.products.firstSaleCount)}</dd>
            </dl>
          </div>
        </div>

        <section className="space-y-3" aria-labelledby="aftershock-unavailable-title">
          <h3 id="aftershock-unavailable-title" className="text-sm font-semibold">Not measurable yet</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded border border-dashed border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">Discovery → opportunity</h4>
                <Badge variant="outline">Unavailable</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{metrics.unavailableMetrics.discoveryToOpportunity.reason}</p>
            </article>
            <article className="rounded border border-dashed border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">Support burden</h4>
                <Badge variant="outline">Unavailable</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{metrics.unavailableMetrics.supportBurden.reason}</p>
            </article>
          </div>
        </section>

        <details className="rounded border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Metric definitions and source records</summary>
          <div className="mt-4 space-y-4 text-xs">
            {([
              ['Opportunity promotion rate', metrics.metricDefinitions.opportunityPromotionRate],
              ['Product publication count', metrics.metricDefinitions.productPublicationCount],
              ['Product first-sale rate', metrics.metricDefinitions.productFirstSaleRate],
              ['Product retirement count', metrics.metricDefinitions.productRetirementCount],
              ['Completed product lifetime', metrics.metricDefinitions.averageCompletedProductLifetimeSeconds],
            ] as const).map(([title, definition]) => (
              <article key={title} className="space-y-1 border-t border-border pt-3 first:border-0 first:pt-0">
                <h4 className="font-semibold">{title}</h4>
                <p><strong>Numerator:</strong> {definition.numerator}</p>
                <p><strong>Denominator:</strong> {definition.denominator}</p>
                <p><strong>Source:</strong> {definition.source}</p>
                <p className="text-muted-foreground">{definition.interpretation}</p>
              </article>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
