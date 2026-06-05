/**
 * Presentation helpers for the dashboard. Pure + client-safe
 * (no server imports) so both `load` data and Svelte components can use them.
 *
 * Enum values are stored in Spanish-uppercase; these map them to
 * human labels, severity color cues, and Córdoba-local timestamps.
 */
import type { IncidentType, SeverityLevel, Status } from './domain/incident';

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
	DERRAME: 'Derrame',
	INCENDIO: 'Incendio',
	EXPOSICION: 'Exposición',
	FUGA_GAS: 'Fuga de gas'
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
	BAJO: 'Bajo',
	MEDIO: 'Medio',
	ALTO: 'Alto',
	CRITICO: 'Crítico'
};

export const STATUS_LABELS: Record<Status, string> = {
	ABIERTO: 'Abierto',
	EN_PROGRESO: 'En progreso',
	RESUELTO: 'Resuelto'
};

/** Badge classes per severity: the color cues (green/gold/orange/red). */
export const SEVERITY_BADGE: Record<SeverityLevel, string> = {
	BAJO: 'bg-severity-bajo/10 text-severity-bajo',
	MEDIO: 'bg-gold/40 text-gold-dark',
	ALTO: 'bg-severity-alto/15 text-severity-alto',
	CRITICO: 'bg-severity-critico/15 text-severity-critico'
};

/** Subtle badge classes per status (brand-neutral). */
export const STATUS_BADGE: Record<Status, string> = {
	ABIERTO: 'bg-teal-primary/10 text-teal-primary',
	EN_PROGRESO: 'bg-gold/40 text-gold-dark',
	RESUELTO: 'bg-muted/15 text-muted'
};

// Store UTC, display America/Argentina/Cordoba.
const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
	timeZone: 'America/Argentina/Cordoba',
	dateStyle: 'medium',
	timeStyle: 'short'
});

/** Format an ISO instant as a Córdoba-local date+time; falls back to raw on parse failure. */
export function formatDateTime(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
}
