/**
 * Shared API error envelope (SPEC shared convention):
 *   { "error": { "code", "message", "details"? } }
 *
 * `formatZodError` turns a zod validation failure into field-level `details` so
 * the agent can self-correct (SPEC §4.1).
 */
import { z } from 'zod';

export interface ApiErrorDetail {
	/** Dotted path to the offending field, e.g. `chemicals_involved.0.name`. */
	field: string;
	message: string;
	/** zod issue code, e.g. `invalid_type`, `too_small`, `unrecognized_keys`. */
	code: string;
}

export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
		details?: ApiErrorDetail[];
	};
}

/** Flatten a ZodError into field-level details. */
export function formatZodError(error: z.ZodError): ApiErrorDetail[] {
	return error.issues.map((issue) => ({
		field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
		message: issue.message,
		code: issue.code
	}));
}

/** Standard validation-error envelope (HTTP 422). */
export function validationError(error: z.ZodError, message = 'Validation failed'): ApiErrorBody {
	return { error: { code: 'validation_error', message, details: formatZodError(error) } };
}

/** Generic error envelope without field details. */
export function apiError(code: string, message: string): ApiErrorBody {
	return { error: { code, message } };
}
