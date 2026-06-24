/**
 * Source Adapter Framework — prime-atlas
 *
 * Every data-source integration must implement SourceAdapter<T>.
 * This keeps ingestion uniform: one pipeline, many adapters.
 *
 * Flow:
 *   AdapterRegistry.run(adapterId, options)
 *     → adapter.fetch()        — pull raw records from the source
 *     → adapter.normalise()    — map to canonical schema
 *     → adapter.upsert()       — write to Supabase, log to ingestion_runs
 */

// ── Canonical row shapes ─────────────────────────────────────────────────────

export interface MunicipalityRow {
  name: string;
  region: string;
  country: string;
  country_id?: string;
  admin_region_id?: string;
  admin_code?: string;
  population: number;
  lat: number;
  lng: number;
  slug: string;
  currency_code: string;
  // scoring — leave 0 until real data drives computation
  growth_score: number;
  infrastructure_score: number;
  development_score: number;
  liquidity_score: number;
  risk_score: number;
  opportunity_score: number;
  // provenance
  source_name: string;
  source_url?: string;
  retrieved_at: string; // ISO 8601
  data_confidence: number; // 0–1
  growth_metrics?: Record<string, unknown>;
}

export interface SignalRow {
  signal_type: string;
  title: string;
  summary: string;
  source: string;
  source_url?: string;
  confidence_level: number;
  opportunity_impact: number;
  municipality_id: string;
  detected_at: string;
  ai_summary?: string;
  retrieved_at?: string;
  data_confidence?: number;
}

export interface InfrastructureProjectRow {
  project_name: string;
  type: string;
  budget: number;
  status: string;
  impact_score: number;
  municipality_id: string;
  expected_completion?: string;
  description?: string;
  source_url?: string;
  source_name: string;
  retrieved_at?: string;
  data_confidence?: number;
}

// ── Adapter interface ────────────────────────────────────────────────────────

export interface AdapterOptions {
  /** ISO-2 market code, e.g. "GB", "ES", "US" */
  market: string;
  /** Max rows to fetch per run (useful for rate-limited APIs) */
  batchSize?: number;
  /** If true, only log what would change — do not write */
  dryRun?: boolean;
  /** Optional date filter — fetch only records updated after this */
  since?: Date;
}

export interface AdapterResult {
  rowsInserted: number;
  rowsUpdated: number;
  rowsErrored: number;
  errors: Array<{ record: unknown; error: string }>;
  durationMs: number;
}

/**
 * SourceAdapter<RawT> — implement this for every external data source.
 *
 * @typeParam RawT  The raw record shape returned by the upstream API / file
 */
export interface SourceAdapter<RawT = unknown> {
  /** Unique identifier — used in ingestion_runs.adapter_name */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Market(s) this adapter covers */
  readonly markets: string[];
  /** How often data refreshes at the source */
  readonly cadence: "daily" | "weekly" | "monthly" | "quarterly" | "realtime";
  /** Attribution to show users next to data points */
  readonly attribution: string;
  readonly attributionUrl: string;

  /** Pull raw records from the upstream source */
  fetch(options: AdapterOptions): Promise<RawT[]>;

  /** Map a raw record to one or more canonical rows */
  normalise(raw: RawT, options: AdapterOptions): Promise<MunicipalityRow | SignalRow | InfrastructureProjectRow | null>;

  /** Write normalised rows to Supabase; returns result summary */
  upsert(rows: Array<MunicipalityRow | SignalRow | InfrastructureProjectRow>, options: AdapterOptions): Promise<AdapterResult>;
}

// ── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, SourceAdapter>();

export function registerAdapter(adapter: SourceAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getAdapter(id: string): SourceAdapter | undefined {
  return registry.get(id);
}

export function listAdapters(): SourceAdapter[] {
  return Array.from(registry.values());
}

export function listAdaptersForMarket(market: string): SourceAdapter[] {
  return Array.from(registry.values()).filter((a) => a.markets.includes(market));
}
