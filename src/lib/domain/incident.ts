/**
 * Incident report domain layer: the canonical contract.
 *
 * This is the single source of truth for the IncidentReport shape that the
 * separate LangChain agent must produce. Enum values are Spanish (UNC Safety
 * Manual); field keys are English.
 *
 * Only writable fields live in the zod schemas. The operational columns
 * (`id`, `created_at`, `updated_at`) are merged in by `toIncidentReport`.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const INCIDENT_TYPES = ['DERRAME', 'INCENDIO', 'EXPOSICION', 'FUGA_GAS'] as const;
export const SEVERITY_LEVELS = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const;
export const STATUSES = ['ABIERTO', 'EN_PROGRESO', 'RESUELTO'] as const;

export const incidentTypeSchema = z.enum(INCIDENT_TYPES);
export const severityLevelSchema = z.enum(SEVERITY_LEVELS);
export const statusSchema = z.enum(STATUSES);

export type IncidentType = z.infer<typeof incidentTypeSchema>;
export type SeverityLevel = z.infer<typeof severityLevelSchema>;
export type Status = z.infer<typeof statusSchema>;

// ---------------------------------------------------------------------------
// Chemical sub-object
// ---------------------------------------------------------------------------
export const chemicalSchema = z.strictObject({
	name: z.string().min(1),
	hazard_class: z.string().min(1).optional(),
	estimated_quantity: z.string().min(1).optional()
});
export type Chemical = z.infer<typeof chemicalSchema>;

// ---------------------------------------------------------------------------
// IncidentReport writable fields
// ---------------------------------------------------------------------------
// Timestamps require an explicit offset ('Z' or a +/-hh:mm offset); local-only
// strings are rejected. This keeps the value a deterministic instant so the DB
// can index it via public.parse_iso_ts (see the initial supabase migration).
const writableShape = {
	timestamp: z.iso.datetime({ offset: true }),
	location: z.string().min(1),
	incident_type: incidentTypeSchema,
	severity_level: severityLevelSchema,
	chemicals_involved: z.array(chemicalSchema),
	actions_taken: z.array(z.string().min(1)).min(1),
	medical_assistance_required: z.boolean(),
	status: statusSchema
} as const;

/**
 * POST body: a full create. `chemicals_involved` defaults to `[]` when omitted.
 * Strict: unknown keys are rejected so the agent gets a clear 422.
 */
export const IncidentReportCreate = z.strictObject({
	...writableShape,
	chemicals_involved: z.array(chemicalSchema).default([])
});
export type IncidentReportCreate = z.infer<typeof IncidentReportCreate>;

/**
 * PATCH body: a partial update. No defaults: an omitted field is simply not
 * present, so the caller's merge leaves the stored value untouched (we must NOT
 * silently wipe `chemicals_involved` to `[]`). Still strict.
 */
export const IncidentReportPatch = z.strictObject(writableShape).partial();
export type IncidentReportPatch = z.infer<typeof IncidentReportPatch>;

// ---------------------------------------------------------------------------
// Read shape (DB columns merged with the data jsonb)
// ---------------------------------------------------------------------------
/** Validated report payload as stored in `incidents.data`. */
export type IncidentReportData = z.infer<typeof IncidentReportCreate>;

/** Full API response shape: payload + operational columns. */
export type IncidentReport = IncidentReportData & {
	id: string;
	created_at: string;
	updated_at: string;
};

/** A row as selected from the `incidents` table. */
export interface IncidentRow {
	id: string;
	created_at: string | Date;
	updated_at: string | Date;
	deleted_at?: string | Date | null;
	data: IncidentReportData;
}

function toIso(value: string | Date): string {
	return value instanceof Date ? value.toISOString() : value;
}

/**
 * Merge the operational columns (`id`, `created_at`, `updated_at`) with the
 * `data` jsonb into the API response shape. Columns are authoritative: they are
 * spread last so a malformed `data` blob can never shadow them.
 */
export function toIncidentReport(row: IncidentRow): IncidentReport {
	return {
		...row.data,
		id: row.id,
		created_at: toIso(row.created_at),
		updated_at: toIso(row.updated_at)
	};
}
