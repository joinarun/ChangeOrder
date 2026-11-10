import { createHash, randomUUID } from 'node:crypto';
import type { Analysis, AnalysisItem, ChangeOrder, ChangeOrderLine, Project } from './types.js';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function sourceHash(project: Project) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        brief: project.brief,
        messages: project.messages,
        hourlyRateCents: project.hourlyRateCents,
      }),
    )
    .digest('hex');
}
export function termsHash(order: ChangeOrder) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: order.id,
        title: order.title,
        summary: order.summary,
        items: order.items,
        amountCents: order.amountCents,
        currency: order.currency,
        revision: order.revision,
        clientName: order.clientName,
        clientEmail: order.clientEmail,
        originalAmountCents: order.originalAmountCents,
        sourceSnapshot: order.sourceSnapshot,
      }),
    )
    .digest('hex');
}
export function validateEvidence(project: Project, items: AnalysisItem[]) {
  for (const item of items) {
    if (!item.evidence.length)
      throw new AppError(
        502,
        'INVALID_AI_EVIDENCE',
        'The model returned a finding without source evidence. Please analyze again.',
      );
    for (const evidence of item.evidence) {
      const source =
        evidence.sourceType === 'brief'
          ? evidence.sourceId === project.id
            ? project.brief
            : undefined
          : project.messages.find((message) => message.id === evidence.sourceId)?.text;
      if (!source || !evidence.quote.trim() || !source.includes(evidence.quote))
        throw new AppError(
          502,
          'INVALID_AI_EVIDENCE',
          'An AI quotation could not be verified against the original source. No proposal was created. Please analyze again.',
        );
    }
    if (
      item.classification === 'change' &&
      !item.evidence.some((evidence) => evidence.sourceType === 'message')
    )
      throw new AppError(
        502,
        'INVALID_AI_EVIDENCE',
        'A proposed change must cite an actual client request. Please analyze again.',
      );
    if (
      item.classification === 'change' &&
      !item.evidence.some((evidence) => evidence.sourceType === 'brief')
    )
      throw new AppError(
        502,
        'INVALID_AI_EVIDENCE',
        'A proposed change must cite the agreed scope. Please analyze again.',
      );
  }
}
export function priceLine(item: AnalysisItem, hours: number, rateCents: number): ChangeOrderLine {
  if (
    !Number.isFinite(hours) ||
    hours <= 0 ||
    hours > 1000 ||
    !Number.isSafeInteger(rateCents) ||
    rateCents < 1 ||
    rateCents > 1_000_000
  )
    throw new AppError(
      400,
      'INVALID_PRICE',
      'Hours and hourly rate must be positive and within supported limits.',
    );
  const amountCents = Math.round(hours * rateCents);
  if (amountCents < 1)
    throw new AppError(400, 'INVALID_PRICE', 'Each line must cost at least one cent.');
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    hours,
    rateCents,
    amountCents,
    evidence: item.evidence,
  };
}
export function buildLines(
  analysis: Analysis,
  project: Project,
  input: {
    itemIds?: string[];
    items?: { analysisItemId: string; hours: number; rateCents: number }[];
  },
) {
  const selected =
    input.items ||
    (
      input.itemIds ||
      analysis.items.filter((item) => item.classification === 'change').map((item) => item.id)
    ).map((id) => ({
      analysisItemId: id,
      hours: analysis.items.find((item) => item.id === id)?.estimatedHours || 0,
      rateCents: project.hourlyRateCents,
    }));
  if (
    !selected.length ||
    selected.length > 20 ||
    new Set(selected.map((line) => line.analysisItemId)).size !== selected.length
  )
    throw new AppError(
      400,
      'INVALID_LINES',
      'Choose between one and twenty distinct additional-work findings.',
    );
  return selected.map((line) => {
    const item = analysis.items.find((candidate) => candidate.id === line.analysisItemId);
    if (!item || item.classification !== 'change')
      throw new AppError(
        400,
        'INCLUDED_WORK',
        'Only findings classified as additional work can be priced.',
      );
    return priceLine(item, line.hours, line.rateCents);
  });
}
export function requireDraft(order: ChangeOrder) {
  if (order.status !== 'draft')
    throw new AppError(
      409,
      'IMMUTABLE_PROPOSAL',
      'Shared proposals are immutable. Create a new proposal for different terms.',
    );
}
export function newOrder(
  project: Project,
  analysis: Analysis,
  input: {
    title?: string;
    summary?: string;
    itemIds?: string[];
    items?: { analysisItemId: string; hours: number; rateCents: number }[];
  },
): ChangeOrder {
  if (sourceHash(project) !== analysis.sourceHash)
    throw new AppError(
      409,
      'STALE_ANALYSIS',
      'The brief or messages changed. Analyze the latest sources before creating a proposal.',
    );
  const items = buildLines(analysis, project, input),
    now = new Date().toISOString();
  return {
    id: randomUUID(),
    projectId: project.id,
    analysisId: analysis.id,
    title: input.title || 'Additional work proposal',
    summary:
      input.summary ||
      'The following work extends our original agreement. Please review the scope and price before accepting.',
    items,
    amountCents: items.reduce((sum, item) => sum + item.amountCents, 0),
    currency: project.currency,
    clientName: project.clientName,
    clientEmail: project.clientEmail,
    freelancerName: project.freelancerName,
    projectTitle: project.title,
    originalAmountCents: project.baseAmountCents,
    sourceSnapshot: { brief: project.brief, messages: structuredClone(project.messages) },
    status: 'draft',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}
