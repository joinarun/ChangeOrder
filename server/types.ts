export type Classification = 'change' | 'included' | 'clarification';
export type OrderStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'invoiced'
  | 'partially_paid'
  | 'paid'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded';
export interface Message {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}
export interface Project {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  freelancerName: string;
  currency: 'USD';
  baseAmountCents: number;
  hourlyRateCents: number;
  brief: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
export interface Evidence {
  sourceType: 'brief' | 'message';
  sourceId: string;
  quote: string;
  label: string;
}
export interface AnalysisItem {
  id: string;
  title: string;
  description: string;
  classification: Classification;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: Evidence[];
  estimatedHours: number;
  suggestedAmountCents: number;
  questions: string[];
}
export interface Analysis {
  id: string;
  projectId: string;
  summary: string;
  items: AnalysisItem[];
  mode: 'live' | 'sample';
  model: string;
  createdAt: string;
  sourceHash: string;
}
export interface ChangeOrderLine {
  id: string;
  title: string;
  description: string;
  hours: number;
  rateCents: number;
  amountCents: number;
  evidence: Evidence[];
}
export interface Invoice {
  id: string;
  number?: string;
  status: string;
  paymentUrl?: string;
  amountCents: number;
  reference?: string;
  currency: string;
  paidAmountCents: number;
  lastSyncedAt: string;
}
export interface ChangeOrder {
  id: string;
  projectId: string;
  analysisId: string;
  title: string;
  summary: string;
  items: ChangeOrderLine[];
  amountCents: number;
  currency: 'USD';
  status: OrderStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  reviewToken?: string;
  clientName: string;
  clientEmail: string;
  freelancerName: string;
  projectTitle: string;
  originalAmountCents?: number;
  sourceSnapshot: { brief: string; messages: Message[] };
  reviewUrl?: string;
  sharedAt?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  declinedAt?: string;
  clientNote?: string;
  termsHash?: string;
  invoice?: Invoice;
}
export interface AuditEvent {
  id: string;
  projectId: string;
  changeOrderId?: string;
  type: string;
  title: string;
  detail: string;
  actor: string;
  createdAt: string;
}
export interface IntegrationState {
  llm: { configured: boolean; model: string; provider: string };
  paypal: { configured: boolean; environment: 'sandbox'; webhookConfigured: boolean };
}
export interface SessionState {
  authorized: boolean;
  authRequired: boolean;
  integrations: IntegrationState;
}
export interface ProjectDetail {
  project: Project;
  analysis: Analysis | null;
  changeOrders: ChangeOrder[];
  audit: AuditEvent[];
}
export interface ReviewDetail {
  project: Pick<
    Project,
    'id' | 'title' | 'clientName' | 'freelancerName' | 'currency' | 'baseAmountCents'
  >;
  changeOrder: ChangeOrder;
  evidence: Evidence[];
  audit: AuditEvent[];
}
