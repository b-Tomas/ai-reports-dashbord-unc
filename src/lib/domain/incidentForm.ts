/**
 * Dashboard create-form parsing (SPEC §4: POST /incidents via UI).
 *
 * Turns a human form submission into the same validated `IncidentReportData`
 * the agent API produces, so both write paths hit one contract (`IncidentReportCreate`).
 * Pure + framework-free (no `$env`, no SvelteKit) so it is unit-testable and can
 * be shared by the `/incidents/new` server action.
 */
import { IncidentReportCreate, type IncidentReportData } from './incident';

/** One chemical row as typed in the form (before optional fields are dropped). */
export interface ChemicalFormRow {
	name: string;
	hazard_class: string;
	estimated_quantity: string;
}

/** Raw form values, echoed back to repopulate the form on validation failure. */
export interface IncidentFormValues {
	timestamp: string; // raw `datetime-local` value (Córdoba wall-clock)
	location: string;
	incident_type: string;
	severity_level: string;
	status: string;
	medical_assistance_required: boolean;
	actions_taken: string[];
	chemicals: ChemicalFormRow[];
}

export type ParseResult =
	| { ok: true; data: IncidentReportData }
	| { ok: false; fieldErrors: Record<string, string>; values: IncidentFormValues };

/**
 * Córdoba is a fixed UTC-3 offset (no DST), so a `datetime-local` value
 * (`YYYY-MM-DDTHH:mm`, optionally with seconds) is anchored by appending the
 * `-03:00` offset — satisfying `z.iso.datetime({ offset: true })`. Empty input
 * stays '' so zod reports the required-field error rather than a bogus instant.
 */
export function cordobaLocalToIso(local: string): string {
	const v = local.trim();
	if (!v) return '';
	const withSeconds = /T\d{2}:\d{2}:\d{2}/.test(v) ? v : `${v}:00`;
	return `${withSeconds}-03:00`;
}

/** Read parallel `chemical_*` field arrays into row objects (one per UI row). */
function readChemicals(form: FormData): ChemicalFormRow[] {
	const names = form.getAll('chemical_name').map(String);
	const hazards = form.getAll('chemical_hazard').map(String);
	const qtys = form.getAll('chemical_qty').map(String);
	const n = Math.max(names.length, hazards.length, qtys.length);
	const rows: ChemicalFormRow[] = [];
	for (let i = 0; i < n; i++) {
		rows.push({
			name: names[i] ?? '',
			hazard_class: hazards[i] ?? '',
			estimated_quantity: qtys[i] ?? ''
		});
	}
	return rows;
}

/**
 * Parse + validate a create-form submission.
 *
 * Empty `actions_taken` rows and chemical rows without a name are dropped before
 * validation (UI scaffolding, not data), so per-element string errors don't fire;
 * `actions_taken.min(1)` still rejects an all-empty list. On failure we return the
 * zod field errors (keyed by dotted path) plus the raw values to repopulate the form.
 */
export function parseIncidentForm(form: FormData): ParseResult {
	const str = (k: string) => String(form.get(k) ?? '').trim();

	const values: IncidentFormValues = {
		timestamp: str('timestamp'),
		location: str('location'),
		incident_type: str('incident_type'),
		severity_level: str('severity_level'),
		status: str('status'),
		medical_assistance_required: form.get('medical_assistance_required') === 'on',
		actions_taken: form.getAll('actions_taken').map(String),
		chemicals: readChemicals(form)
	};

	const candidate = {
		timestamp: cordobaLocalToIso(values.timestamp),
		location: values.location,
		incident_type: values.incident_type,
		severity_level: values.severity_level,
		status: values.status,
		medical_assistance_required: values.medical_assistance_required,
		actions_taken: values.actions_taken.map((a) => a.trim()).filter((a) => a !== ''),
		chemicals_involved: values.chemicals
			.filter((c) => c.name.trim() !== '')
			.map((c) => {
				const chem: { name: string; hazard_class?: string; estimated_quantity?: string } = {
					name: c.name.trim()
				};
				const hc = c.hazard_class.trim();
				const eq = c.estimated_quantity.trim();
				if (hc) chem.hazard_class = hc;
				if (eq) chem.estimated_quantity = eq;
				return chem;
			})
	};

	const parsed = IncidentReportCreate.safeParse(candidate);
	if (parsed.success) return { ok: true, data: parsed.data };

	const fieldErrors: Record<string, string> = {};
	for (const issue of parsed.error.issues) {
		const key = issue.path.join('.') || '_';
		if (!fieldErrors[key]) fieldErrors[key] = issue.message;
	}
	return { ok: false, fieldErrors, values };
}
