import { z } from 'zod';
import { PHASE_1_TAXONOMY, type TaxonomyEntry } from '../taxonomy';
import { urgencySchema } from '../safety/red-flags';

/**
 * The AI output contract (design D8).
 *
 * One strict schema is the source of truth for both ends of the model call: it generates the
 * JSON Schema handed to the model as a tool definition, and it validates the response before
 * anything touches the database. Because the object is `strict()`, an undefined field such as
 * `final_diagnosis` is a hard rejection rather than something to trim — and there is no code
 * path that can add one.
 *
 * A schema violation is a *failure to retry*, never something to coerce or partially save.
 */

export const MANDATORY_DISCLAIMER =
  'This is an AI-generated decision-support summary based on patient-reported information and is ' +
  'not a medical diagnosis. It has not yet been reviewed by a physician. All clinical decisions ' +
  'must be made by the treating doctor after direct evaluation.';

export const likelihoodSchema = z.enum(['high', 'moderate', 'low']);
export type Likelihood = z.infer<typeof likelihoodSchema>;

const finding = z.string().min(3).max(500);

export const differentialItemSchema = z
  .object({
    /**
     * Constrained to the active taxonomy at validation time (see `buildAssessmentSchema`).
     * The model may not invent a condition outside the scope the clinician reviewed.
     */
    condition: z.string().min(1),
    likelihood: likelihoodSchema,
    supporting_findings: z.array(finding).min(1).max(12),
    contradicting_or_atypical_findings: z.array(finding).max(12),
    suggested_confirmatory_steps: z.array(finding).max(8),
  })
  .strict();

export const redFlagItemSchema = z
  .object({
    flag: z.string().min(3).max(300),
    basis: z.string().min(3).max(500),
    urgency: urgencySchema,
  })
  .strict();

/** The base shape. Use `buildAssessmentSchema` to bind it to a taxonomy and reject treatment content. */
export const aiAssessmentBaseSchema = z
  .object({
    case_id: z.string().min(1),
    model_version: z.string().min(1),
    prompt_version: z.string().min(1),
    kb_version: z.string().min(1),
    generated_at: z.string().datetime({ offset: true }),
    differential_assessment: z.array(differentialItemSchema).min(1).max(8),
    red_flags: z.array(redFlagItemSchema).max(12),
    recommended_next_steps: z.array(finding).max(10),
    clinician_summary: z.string().min(20).max(4000),
    disclaimer: z.literal(MANDATORY_DISCLAIMER),
  })
  .strict();

export type AiAssessment = z.infer<typeof aiAssessmentBaseSchema>;

/* ------------------------------------------------------------------------------------------ */
/* Prohibited content                                                                          */
/* ------------------------------------------------------------------------------------------ */

/**
 * The model is instructed never to name a medication, dose, or treatment plan. Instructions
 * are not a control, so the output is also screened. The list is deliberately conservative and
 * configurable — a clinician tunes it rather than an engineer.
 */
export const PROHIBITED_MEDICATION_TERMS: readonly string[] = [
  'omeprazole', 'pantoprazole', 'esomeprazole', 'lansoprazole', 'rabeprazole',
  'ranitidine', 'famotidine', 'sucralfate', 'antacid', 'mesalamine', 'mesalazine',
  'sulfasalazine', 'azathioprine', 'mercaptopurine', 'methotrexate', 'infliximab',
  'adalimumab', 'vedolizumab', 'ustekinumab', 'budesonide', 'prednisolone',
  'prednisone', 'corticosteroid', 'steroid', 'metronidazole', 'ciprofloxacin',
  'amoxicillin', 'clarithromycin', 'tetracycline', 'levofloxacin', 'rifaximin',
  'loperamide', 'ondansetron', 'domperidone', 'metoclopramide', 'hyoscine',
  'mebeverine', 'lactulose', 'ursodeoxycholic', 'propranolol', 'octreotide',
  'terlipressin', 'ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'paracetamol',
  'acetaminophen', 'tramadol', 'morphine', 'pethidine',
];

/** Dose and regimen patterns, which catch medications the name list does not. */
export const PROHIBITED_DOSE_PATTERNS: readonly RegExp[] = [
  /\b\d+(\.\d+)?\s?(mg|mcg|µg|g|ml|iu|units?)\b/i,
  /\b(bd|tds|qds|od|hs|prn|q\d+h)\b/i,
  /\b(once|twice|thrice|three times|four times)\s+(a|per)\s+day\b/i,
  /\b(start|begin|commence|prescribe|prescribing|initiate)\s+(on\s+)?(a\s+)?(course\s+of\s+)?\w+/i,
  /\btriple therapy\b/i,
  /\beradication (therapy|regimen)\b/i,
];

export interface ProhibitedContentFinding {
  field: string;
  kind: 'medication_name' | 'dose_or_regimen';
  match: string;
}

function walkStrings(value: unknown, path: string, visit: (text: string, path: string) => void): void {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkStrings(item, `${path}[${i}]`, visit));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, path === '' ? key : `${path}.${key}`, visit);
    }
  }
}

export function findProhibitedTreatmentContent(
  candidate: unknown,
  medicationTerms: readonly string[] = PROHIBITED_MEDICATION_TERMS,
  dosePatterns: readonly RegExp[] = PROHIBITED_DOSE_PATTERNS,
): ProhibitedContentFinding[] {
  const findings: ProhibitedContentFinding[] = [];
  walkStrings(candidate, '', (text, path) => {
    // The disclaimer is fixed text we authored; screening it would be circular.
    if (path === 'disclaimer') return;
    const lower = text.toLowerCase();
    for (const term of medicationTerms) {
      if (lower.includes(term)) {
        findings.push({ field: path, kind: 'medication_name', match: term });
      }
    }
    for (const pattern of dosePatterns) {
      const match = pattern.exec(text);
      if (match) {
        findings.push({ field: path, kind: 'dose_or_regimen', match: match[0] });
      }
    }
  });
  return findings;
}

/* ------------------------------------------------------------------------------------------ */
/* Taxonomy-bound schema and validation                                                        */
/* ------------------------------------------------------------------------------------------ */

export interface AssessmentSchemaOptions {
  taxonomy?: readonly TaxonomyEntry[];
  medicationTerms?: readonly string[];
  dosePatterns?: readonly RegExp[];
}

export type AssessmentRejectionCode =
  | 'schema_violation'
  | 'off_taxonomy_condition'
  | 'duplicate_condition'
  | 'prohibited_treatment_content'
  | 'malignancy_subtype_differentiation'
  | 'missing_disclaimer';

export interface AssessmentRejection {
  code: AssessmentRejectionCode;
  message: string;
  details: string[];
}

export type AssessmentValidation =
  | { ok: true; assessment: AiAssessment; conditionIds: string[] }
  | { ok: false; rejections: AssessmentRejection[] };

/**
 * Validates a raw model response.
 *
 * Everything here is a rejection, never a repair. The caller retries with a stricter reminder
 * and, once the retry budget is spent, routes the case to the doctor with no assessment at all.
 */
export function validateAssessment(
  raw: unknown,
  options: AssessmentSchemaOptions = {},
): AssessmentValidation {
  const taxonomy = (options.taxonomy ?? PHASE_1_TAXONOMY).filter((entry) => entry.active);
  const rejections: AssessmentRejection[] = [];

  const parsed = aiAssessmentBaseSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
    );
    const missingDisclaimer = parsed.error.issues.some((issue) => issue.path[0] === 'disclaimer');
    return {
      ok: false,
      rejections: [
        {
          code: missingDisclaimer && details.length === 1 ? 'missing_disclaimer' : 'schema_violation',
          message: 'Model response does not conform to the assessment schema',
          details,
        },
      ],
    };
  }

  const assessment = parsed.data;
  const byLabel = new Map(taxonomy.map((entry) => [entry.label.toLowerCase(), entry]));
  const byId = new Map(taxonomy.map((entry) => [entry.id.toLowerCase(), entry]));

  const conditionIds: string[] = [];
  const offTaxonomy: string[] = [];
  for (const item of assessment.differential_assessment) {
    const key = item.condition.trim().toLowerCase();
    const entry = byLabel.get(key) ?? byId.get(key);
    if (!entry) offTaxonomy.push(item.condition);
    else conditionIds.push(entry.id);
  }

  if (offTaxonomy.length > 0) {
    rejections.push({
      code: 'off_taxonomy_condition',
      message: 'Model named a condition outside the reviewed disease taxonomy',
      details: offTaxonomy,
    });
  }

  const duplicates = conditionIds.filter((id, i) => conditionIds.indexOf(id) !== i);
  if (duplicates.length > 0) {
    rejections.push({
      code: 'duplicate_condition',
      message: 'The differential lists the same condition more than once',
      details: [...new Set(duplicates)],
    });
  }

  // The taxonomy exposes a single malignancy category on purpose; subtype differentiation is
  // a specialist judgement made after imaging and histology, not a questionnaire inference.
  const malignancyEntries = conditionIds.filter(
    (id) => taxonomy.find((entry) => entry.id === id)?.urgentReferralOnly === true,
  );
  if (malignancyEntries.length > 1) {
    rejections.push({
      code: 'malignancy_subtype_differentiation',
      message: 'Model attempted to differentiate malignancy subtypes',
      details: malignancyEntries,
    });
  }

  const prohibited = findProhibitedTreatmentContent(
    assessment,
    options.medicationTerms,
    options.dosePatterns,
  );
  if (prohibited.length > 0) {
    rejections.push({
      code: 'prohibited_treatment_content',
      message: 'Model response names a medication, dose, or treatment regimen',
      details: prohibited.map((finding) => `${finding.field}: "${finding.match}" (${finding.kind})`),
    });
  }

  if (rejections.length > 0) return { ok: false, rejections };
  return { ok: true, assessment, conditionIds };
}

/**
 * The JSON Schema handed to the model as a tool definition. Generated from the same shape the
 * validator enforces, with `condition` enumerated from the live taxonomy so the model is told
 * the exact permitted vocabulary rather than being left to guess it.
 */
export function assessmentToolJsonSchema(
  taxonomy: readonly TaxonomyEntry[] = PHASE_1_TAXONOMY,
): Record<string, unknown> {
  const conditions = taxonomy.filter((entry) => entry.active).map((entry) => entry.label);
  const stringArray = (maxItems: number, minItems = 0) => ({
    type: 'array',
    minItems,
    maxItems,
    items: { type: 'string', minLength: 3, maxLength: 500 },
  });

  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'case_id',
      'model_version',
      'prompt_version',
      'kb_version',
      'generated_at',
      'differential_assessment',
      'red_flags',
      'recommended_next_steps',
      'clinician_summary',
      'disclaimer',
    ],
    properties: {
      case_id: { type: 'string', minLength: 1 },
      model_version: { type: 'string', minLength: 1 },
      prompt_version: { type: 'string', minLength: 1 },
      kb_version: { type: 'string', minLength: 1 },
      generated_at: { type: 'string', format: 'date-time' },
      differential_assessment: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'condition',
            'likelihood',
            'supporting_findings',
            'contradicting_or_atypical_findings',
            'suggested_confirmatory_steps',
          ],
          properties: {
            condition: { type: 'string', enum: conditions },
            likelihood: { type: 'string', enum: ['high', 'moderate', 'low'] },
            supporting_findings: stringArray(12, 1),
            contradicting_or_atypical_findings: stringArray(12),
            suggested_confirmatory_steps: stringArray(8),
          },
        },
      },
      red_flags: {
        type: 'array',
        maxItems: 12,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['flag', 'basis', 'urgency'],
          properties: {
            flag: { type: 'string', minLength: 3, maxLength: 300 },
            basis: { type: 'string', minLength: 3, maxLength: 500 },
            urgency: { type: 'string', enum: ['emergency', 'urgent', 'routine-but-flagged'] },
          },
        },
      },
      recommended_next_steps: stringArray(10),
      clinician_summary: { type: 'string', minLength: 20, maxLength: 4000 },
      disclaimer: { type: 'string', const: MANDATORY_DISCLAIMER },
    },
  };
}
