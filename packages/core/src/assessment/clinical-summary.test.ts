import { describe, expect, it } from 'vitest';
import { compileClinicalSummary, type ClinicalSummaryInput } from './clinical-summary';
import { computeInterview } from '../questionnaire/interview';
import { indexTemplate } from '../questionnaire/template';
import { evaluateRedFlags } from '../safety/red-flags';
import { activeAnswerMap, type AnswerValue, type RecordedAnswer } from '../questionnaire/answers';
import {
  bleedingRedFlags,
  bleedingTemplate,
  resolveEnglish,
} from '../__fixtures__/bleeding-template';

const index = indexTemplate(bleedingTemplate);
const at = new Date('2026-08-01T00:00:00Z');
const answer = (questionId: string, value: AnswerValue): RecordedAnswer => ({
  questionId,
  value,
  answeredAt: at,
  active: true,
});
const select = (optionId: string): AnswerValue => ({ kind: 'single_select', optionId });

function compile(answers: RecordedAnswer[], ageYears: number | null = 52) {
  const subject = ageYears === null ? {} : { ageYears };
  const interview = computeInterview({ index, entryPointId: 'ep_bleeding', answers, subject });
  const redFlags = evaluateRedFlags({
    ruleSet: bleedingRedFlags,
    answers: activeAnswerMap(answers),
    subject,
  });
  const input: ClinicalSummaryInput = {
    caseId: 'case_1',
    index,
    orderedQuestionIds: interview.activeQuestionIds,
    answers,
    revealedBy: new Map(
      interview.activeQuestions.map((entry) => [entry.question.id, entry.revealedByQuestionId]),
    ),
    redFlags: redFlags.triggered,
    documents: [],
    subject: { ageYears, sex: 'female' },
    resolve: resolveEnglish,
  };
  return compileClinicalSummary(input);
}

const melaenaPath = [
  answer('q_blood', select('yes')),
  answer('q_blood_appearance', select('black_tarry')),
  answer('q_lightheaded', select('yes')),
  answer('q_fainting', select('no')),
  answer('q_blood_duration', { kind: 'duration', days: 21 }),
  answer('q_weight_loss', select('no')),
];

describe('determinism', () => {
  it('compiles the same case identically every time', () => {
    const runs = Array.from({ length: 10 }, () => JSON.stringify(compile(melaenaPath)));
    expect(new Set(runs).size).toBe(1);
  });

  it('involves no model and no randomness — two independent compilations match exactly', () => {
    expect(compile(melaenaPath)).toEqual(compile(melaenaPath));
  });
});

describe('explicitly denied versus never asked', () => {
  it('records a denial as absent, not as silence', () => {
    const summary = compile(melaenaPath);
    const weightLoss = summary.facts.find((fact) => fact.questionId === 'q_weight_loss');
    expect(weightLoss?.presence).toBe('absent');
    expect(summary.deniedFindings).toContain('Have you lost weight without trying to?');
  });

  it('leaves an unasked question out of the fact table entirely', () => {
    const summary = compile(melaenaPath);
    expect(summary.facts.map((fact) => fact.questionId)).not.toContain('q_blood_position');
    expect(summary.deniedFindings).not.toContain(
      'Is the blood mixed into the stool, or does it coat the outside?',
    );
  });

  it('tells the model in prose that unanswered questions are unknown, not absent', () => {
    const partial = compile([answer('q_blood', select('yes'))]);
    expect(partial.narrative).toContain('Not answered');
    expect(partial.narrative).toMatch(/unknown, not as absent/i);
  });

  it('marks affirmations as present', () => {
    const summary = compile(melaenaPath);
    expect(summary.presentFindings.join(' | ')).toContain('Black and tarry');
  });
});

describe('branching context', () => {
  it('records why each follow-up question was asked', () => {
    const summary = compile(melaenaPath);
    const lightheaded = summary.facts.find((fact) => fact.questionId === 'q_lightheaded');
    expect(lightheaded?.askedBecause).toBe('What does the blood look like?');
    expect(summary.narrative).toContain('asked because');
  });

  it('leaves entry-group questions without a trigger', () => {
    const summary = compile(melaenaPath);
    const root = summary.facts.find((fact) => fact.questionId === 'q_blood');
    expect(root?.askedBecause).toBeUndefined();
  });
});

describe('grouping by symptom cluster', () => {
  it('files each fact under its group cluster', () => {
    const summary = compile(melaenaPath);
    expect(Object.keys(summary.factsByCluster).sort()).toEqual([
      'bleeding',
      'systemic',
      'weight_appetite',
    ]);
    expect(summary.factsByCluster.systemic?.map((fact) => fact.questionId)).toEqual([
      'q_lightheaded',
      'q_fainting',
    ]);
  });
});

describe('answer rendering', () => {
  it('renders durations in human terms rather than raw days', () => {
    const summary = compile(melaenaPath);
    const duration = summary.facts.find((fact) => fact.questionId === 'q_blood_duration');
    expect(duration?.answer).toBe('about 3 weeks');
  });

  it('renders numeric answers with their unit', () => {
    const summary = compile([
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('bright_red')),
      answer('q_blood_position', select('mixed_in')),
      answer('q_blood_frequency', {
        kind: 'numeric',
        value: 6,
        unit: 'episodes in the past 2 weeks',
      }),
    ]);
    const frequency = summary.facts.find((fact) => fact.questionId === 'q_blood_frequency');
    expect(frequency?.answer).toBe('6 episodes in the past 2 weeks');
    expect(frequency?.presence).toBe('value');
  });

  it('renders a multi-select as its option labels', () => {
    const summary = compile([
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('bright_red')),
      answer('q_blood_position', select('coats_separate')),
      answer('q_anal_symptoms', { kind: 'multi_select', optionIds: ['pain', 'lump'] }),
    ]);
    const anal = summary.facts.find((fact) => fact.questionId === 'q_anal_symptoms');
    expect(anal?.answer).toBe('Pain; A lump');
  });
});

describe('red flags in the summary', () => {
  it('carries the triggered flags with resolved, symptom-based basis text', () => {
    const summary = compile(melaenaPath);
    expect(summary.redFlags.map((flag) => flag.ruleId)).toContain(
      'rf_upper_gi_bleed_with_hypovolaemia',
    );
    expect(summary.redFlags[0]?.basis).toContain('urgent in-person care');
  });

  it('tells the model the flags are not its to raise, lower, or suppress', () => {
    const summary = compile(melaenaPath);
    expect(summary.narrative).toMatch(/not yours to raise, lower, or suppress/i);
    expect(summary.narrative).toMatch(/before any model was involved/i);
  });
});

describe('prior reports', () => {
  it('marks an AI-extracted summary as unverified', () => {
    const base = compile(melaenaPath);
    const withDocument = compileClinicalSummary({
      caseId: 'case_1',
      index,
      orderedQuestionIds: base.facts.map((fact) => fact.questionId),
      answers: melaenaPath,
      revealedBy: new Map(),
      redFlags: [],
      documents: [
        {
          documentId: 'doc_1',
          reportType: 'colonoscopy report',
          reportDate: '2025-11-02',
          keyFindings: ['Two sessile polyps in the sigmoid colon'],
          abnormalValues: [],
          machineReadable: true,
          aiGeneratedUnverified: true,
        },
      ],
      subject: { ageYears: 52, sex: 'female' },
      resolve: resolveEnglish,
    });
    expect(withDocument.narrative).toContain('AI-extracted, unverified by a clinician');
    expect(withDocument.narrative).toContain('Two sessile polyps');
  });

  it('says plainly when a document could not be read, rather than omitting it', () => {
    const summary = compileClinicalSummary({
      caseId: 'case_1',
      index,
      orderedQuestionIds: [],
      answers: [],
      revealedBy: new Map(),
      redFlags: [],
      documents: [
        {
          documentId: 'doc_2',
          reportType: 'scanned discharge summary',
          reportDate: null,
          keyFindings: [],
          abnormalValues: [],
          machineReadable: false,
          aiGeneratedUnverified: false,
        },
      ],
      subject: { ageYears: null, sex: null },
      resolve: resolveEnglish,
    });
    expect(summary.narrative).toContain('not machine-readable');
    expect(summary.narrative).toContain('read the original');
  });
});

describe('subject line', () => {
  it('states an unrecorded age rather than inventing one', () => {
    const summary = compile(melaenaPath, null);
    expect(summary.narrative).toContain('age not recorded');
  });
});

describe('retracted answers', () => {
  it('excludes an inactive answer from the fact table', () => {
    const answers: RecordedAnswer[] = [
      ...melaenaPath,
      { questionId: 'q_blood_position', value: select('mixed_in'), answeredAt: at, active: false },
    ];
    const summary = compile(answers);
    expect(summary.facts.map((fact) => fact.questionId)).not.toContain('q_blood_position');
  });
});
