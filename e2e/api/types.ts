/**
 * Contrato de la API según backend/README.md y Swagger (/docs/openapi.json).
 * Solo lo que usan las pruebas; se escribe desde la documentación, no desde el código.
 */

export type MeterStatus = 'NORMAL' | 'ALERT' | 'CRITICAL'
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'
export type AnomalyType = 'REAL_ANOMALY' | 'EXPLAINABLE_ANOMALY' | 'FALSE_POSITIVE' | 'DATA_QUALITY'
export type SortField = 'meter_id' | 'consumption' | 'variation' | 'severity'
export type SortOrder = 'ASC' | 'DESC'

export interface ApiErrorBody {
  status_code: number
  message: string
  errors?: string[]
  timestamp: string
  path: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: { email: string; name: string }
}

export interface Option {
  id: string
  value: string
}

export interface MeterParams {
  meters: Option[]
  statuses: Option[]
  sort_fields: Option[]
  sort_orders: Option[]
}

export interface MeterListRequest {
  pagination?: { page?: number; size?: number }
  filter?: {
    meter_id?: string
    status?: string
    sort_by?: string
    sort_order?: string
  }
}

export interface Paged<T> {
  page: number
  size: number
  count: number
  rows: T[]
}

export interface MeterSummary {
  meter_id: string
  status: MeterStatus
  severity: Severity | null
  anomaly_type: AnomalyType | null
  priority: number | null
  consumption_kwh: number
  baseline_kwh: number
  variation_pct: number
  last_reading_at: string
}

export interface MeterEvent {
  meter_id: string
  timestamp: string
  type: string
  description: string
}

export interface ConsumptionChange {
  start: string
  end: string
  hours: number
  direction: 'UP' | 'DOWN'
  expected_kwh: number
  actual_kwh: number
  change_pct: number
  ongoing: boolean
}

export interface QualityReport {
  flagged_hours: number
  missing_hours: number
  duplicate_readings: number
  first_flagged: string
  last_flagged: string
}

export interface Check {
  description: string
  weight: number
  strength: number
}

export interface Anomaly {
  meter_id: string
  anomaly: boolean
  type: AnomalyType
  severity: Severity
  confidence: number
  priority: number
  detected_at: string
  reason: string
  recommended_action: string
  narrated_by: string
  evidence: {
    baseline_daily_kwh: number
    last_day_kwh: number
    daily_change_pct: number
    window_start: string
    window_end: string
    impact_kwh: number
    change?: ConsumptionChange
    quality?: QualityReport
    related_events: MeterEvent[]
    checks: Check[]
  }
}

export interface MeterDetail extends MeterSummary {
  electrical: Record<'voltage_v' | 'current_a' | 'power_factor', { value: number; baseline: number; change_pct: number }>
  hourly_history: { timestamp: string; consumption_kwh: number }[]
  daily_history: { date: string; consumption_kwh: number; baseline_kwh: number }[]
  anomaly: Anomaly | null
  events: MeterEvent[]
}

export interface DashboardSummary {
  total_meters: number
  status_counts: { normal: number; alert: number; critical: number }
  anomalies_detected: number
  requiring_attention: number
  ai_confidence: number
  anomalies_by_type: Record<AnomalyType, number>
  consumption: { period_kwh: number; last_day_kwh: number; baseline_daily_kwh: number; variation_pct: number }
  data_range: { from: string; to: string }
  priorities: { meter_id: string; priority: number; anomaly: boolean }[]
  last_analysis: { id: string; status: string; trigger: string }
}

export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export interface AnalysisRun {
  id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  trigger: 'STARTUP' | 'MANUAL'
  narrator: string
  started_at: string
  finished_at: string | null
  steps: { key: string; label: string; status: StepStatus; detail: string }[]
  summary: { anomalies_detected: number; requiring_attention: number } | null
}
