import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  FileText,
  FolderOpen,
  History,
  Info,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Wallet,
  X,
  AlertCircle,
  Unplug,
  Users,
} from 'lucide-react';
import type {
  Analysis,
  AnalysisItem,
  AuditEvent,
  ChangeOrder,
  Evidence,
  IntegrationState,
  Project,
  ProjectDetail,
  ReviewDetail,
  SessionState,
} from '../server/types';
const ScopeLedger = lazy(() =>
  import('./ScopeLedger').then((module) => ({ default: module.ScopeLedger })),
);

const PUBLIC_DEMO = import.meta.env.MODE === 'demo';
const SOURCE_URL = 'https://github.com/joinarun/ChangeOrder';
const VIDEO_URL = 'https://www.youtube.com/watch?v=Ot-nicfez7c';

type Stage = 'brief' | 'scope' | 'proposal' | 'activity';
type ModalName = 'new-project' | 'guide' | 'integrations' | 'edit-proposal' | null;
const stages: { id: Stage; label: string }[] = [
  { id: 'brief', label: 'Brief & requests' },
  { id: 'scope', label: 'Scope review' },
  { id: 'proposal', label: 'Change order' },
  { id: 'activity', label: 'Activity' },
];

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (PUBLIC_DEMO) return (await import('./demo-api')).demoApi<T>(path, options);
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
const post = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) });
const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const initials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
const statusText: Record<string, string> = {
  draft: 'Draft',
  sent: 'Awaiting approval',
  accepted: 'Client approved',
  declined: 'Declined',
  invoiced: 'Awaiting payment',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
};
function Status({ value }: { value: string }) {
  const color =
    value === 'paid' || value === 'accepted'
      ? 'green'
      : value === 'declined' || value === 'cancelled'
        ? 'red'
        : value === 'draft'
          ? ''
          : value === 'sent' || value === 'partially_refunded'
            ? 'amber'
            : 'blue';
  return <span className={`status ${color}`}>{statusText[value] || value}</span>;
}
function Brand() {
  return (
    <a className="brand" href={import.meta.env.BASE_URL} aria-label="ChangeOrder home">
      <span className="brand-mark">co</span>
      <span>
        ChangeOrder<small>Good work, clearly agreed.</small>
      </span>
    </a>
  );
}
function PublicSampleNotice({ onStart, busy = false }: { onStart?: () => void; busy?: boolean }) {
  if (!PUBLIC_DEMO) return null;
  return (
    <aside className="public-sample-notice" aria-label="Interactive sample information">
      <div>
        <strong>
          <BookOpen size={14} /> Try the scope-to-approval flow
        </strong>
        <p>
          Prewritten sample findings. Your edits and test approvals stay in this browser. Client
          review opens in another tab of the same browser. Live AI and PayPal invoicing require the
          full local build with your own credentials.
        </p>
      </div>
      <div className="public-sample-actions">
        {onStart && (
          <button className="sample-start" onClick={onStart} disabled={busy}>
            <Sparkles size={12} /> Review supplied requests <ArrowRight size={11} />
          </button>
        )}
        <a href={VIDEO_URL} target="_blank" rel="noreferrer">
          Watch the 2:41 app demo <ExternalLink size={11} />
        </a>
        <a href={`${SOURCE_URL}#run-locally`} target="_blank" rel="noreferrer">
          Run the full app <ArrowRight size={11} />
        </a>
        <button
          onClick={async () => {
            (await import('./demo-api')).resetDemo();
            window.location.assign(import.meta.env.BASE_URL);
          }}
        >
          <RefreshCw size={11} /> Reset sample
        </button>
      </div>
    </aside>
  );
}
function Button({
  children,
  busy = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || busy} className={`btn ${className}`}>
      {busy && <LoaderCircle size={13} className="spin" />}
      {children}
    </button>
  );
}
function Alert({
  children,
  onClose,
  type = 'error',
}: {
  children: ReactNode;
  onClose?: () => void;
  type?: 'error' | 'info' | 'success';
}) {
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`alert alert-${type}`}>
      <AlertCircle size={15} />
      <span>{children}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
function EvidenceQuotes({ evidence }: { evidence: Evidence[] }) {
  return (
    <>
      {evidence.map((item, index) => (
        <div key={`${item.sourceId}-${index}`}>
          <div className="evidence-label">
            {item.sourceType === 'brief' ? <FileText size={11} /> : <MessageSquareText size={11} />}
            {item.label || (item.sourceType === 'brief' ? 'Original agreement' : 'Client request')}
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCheck size={10} /> Source verified
            </span>
          </div>
          <blockquote className="quote" style={{ margin: 0 }}>
            “{item.quote}”
          </blockquote>
        </div>
      ))}
    </>
  );
}

export default function App() {
  const reviewToken = PUBLIC_DEMO
    ? new URLSearchParams(window.location.search).get('review')
    : window.location.pathname.match(/^\/review\/([^/]+)\/?$/)?.[1];
  return reviewToken ? <ClientReview token={reviewToken} /> : <Workspace />;
}

function Workspace() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [stage, setStage] = useState<Stage>('brief');
  const [modal, setModal] = useState<ModalName>(null);
  const [showProjectList, setShowProjectList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [mode, setMode] = useState<'live' | 'sample'>('live');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [scopeView, setScopeView] = useState<'cards' | 'ledger'>('cards');
  const [hours, setHours] = useState<Record<string, number>>({});
  const [rate, setRate] = useState(60);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    api<SessionState>('/session')
      .then((data) => {
        setSession(data);
        setMode(data.integrations.llm.configured ? 'live' : 'sample');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4800);
    return () => clearTimeout(timer);
  }, [toast]);
  const loadProjects = useCallback(async (preferredId?: string) => {
    const data = await api<{ projects: Project[] }>('/projects');
    setProjects(data.projects);
    if (preferredId) setProjectId(preferredId);
    else setProjectId((previous) => previous || data.projects[0]?.id || null);
  }, []);
  useEffect(() => {
    if (session?.authorized) loadProjects().catch((e) => setError(e.message));
  }, [session?.authorized, loadProjects]);
  const loadDetail = useCallback(
    async (id = projectId) => {
      if (!id) return;
      const result = await api<ProjectDetail>(`/projects/${id}`);
      setDetail(result);
      return result;
    },
    [projectId],
  );
  useEffect(() => {
    if (!projectId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setError('');
    loadDetail(projectId)
      .catch((e) => setError(e.message))
      .finally(() => setDetailLoading(false));
  }, [projectId, loadDetail]);
  useEffect(() => {
    if (!detail?.analysis) return;
    setSelectedItems(
      detail.analysis.items
        .filter((item) => item.classification === 'change')
        .map((item) => item.id),
    );
    setHours(
      Object.fromEntries(detail.analysis.items.map((item) => [item.id, item.estimatedHours])),
    );
    setRate(detail.project.hourlyRateCents / 100);
  }, [detail?.analysis?.id]);
  const activeOrder = useMemo(
    () =>
      detail?.changeOrders.find((item) => item.id === activeOrderId) ||
      detail?.changeOrders[0] ||
      null,
    [detail, activeOrderId],
  );
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };
  const loadExample = () =>
    run('seed', async () => {
      const { project } = await post<{ project: Project }>('/projects/seed');
      await loadProjects(project.id);
      setShowProjectList(false);
      setStage('brief');
      setToast('Example project is ready. No client data or real money is involved.');
    });
  const analyze = () =>
    run('analyze', async () => {
      if (!detail) return;
      await post(`/projects/${detail.project.id}/analyze`, { mode });
      await loadDetail();
      setStage('scope');
      setToast(
        mode === 'live'
          ? 'Scope review complete. Source quotes have been verified.'
          : 'Sample analysis loaded. Switch to live AI for your own requests.',
      );
    });
  const addMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !newMessage.trim()) return;
    await run('message', async () => {
      await post(`/projects/${detail.project.id}/messages`, {
        text: newMessage.trim(),
        author: detail.project.clientName,
      });
      setNewMessage('');
      await loadDetail();
      setToast('Client request added. Run the scope review to include it.');
    });
  };
  const createProposal = () =>
    run('proposal', async () => {
      if (!detail?.analysis || !selectedItems.length) return;
      const { changeOrder } = await post<{ changeOrder: ChangeOrder }>(
        `/projects/${detail.project.id}/change-orders`,
        {
          analysisId: detail.analysis.id,
          itemIds: selectedItems,
          items: selectedItems.map((id) => ({
            analysisItemId: id,
            hours: hours[id] ?? 0,
            rateCents: Math.round(rate * 100),
          })),
        },
      );
      await loadDetail();
      setActiveOrderId(changeOrder.id);
      setStage('proposal');
      setToast('Change order drafted. Review the price before sharing.');
    });
  const shareOrder = () =>
    run('share', async () => {
      if (!activeOrder) return;
      await post(`/change-orders/${activeOrder.id}/share`);
      await loadDetail();
      setToast('Client review link created. The proposal is now locked for approval.');
    });
  const createInvoice = () =>
    run('invoice', async () => {
      if (!activeOrder) return;
      await post(`/change-orders/${activeOrder.id}/invoice`);
      await loadDetail();
      setToast('PayPal sandbox invoice is ready. Share its payment link.');
    });
  const syncOrder = () =>
    run('sync', async () => {
      if (!activeOrder) return;
      await post(`/change-orders/${activeOrder.id}/sync`);
      await loadDetail();
      setToast('Payment status checked with PayPal.');
    });
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast('Copied to clipboard.');
    } catch {
      setToast('Copy is unavailable. Select the link and copy it from the address bar.');
    }
  };
  const exportEvidence = () =>
    run('export', async () => {
      if (!detail) return;
      const evidence = await api<unknown>(`/projects/${detail.project.id}/export`);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'changeorder-evidence.json';
      link.click();
      URL.revokeObjectURL(url);
      setToast('Evidence and activity exported.');
    });

  if (loading)
    return (
      <div className="loading-page">
        <LoaderCircle size={18} className="spin" /> Opening your workspace…
      </div>
    );
  if (!session)
    return (
      <div className="review-content">
        <Brand />
        <div style={{ marginTop: 50 }}>
          <Alert>{error || 'The ChangeOrder server could not be reached.'}</Alert>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw size={13} /> Try again
          </Button>
        </div>
      </div>
    );
  if (!session.authorized) return <Login onSuccess={(data) => setSession(data)} />;

  const project = detail?.project;
  const selectedAnalysisItems =
    detail?.analysis?.items.filter((item) => selectedItems.includes(item.id)) || [];
  const totalCents = selectedAnalysisItems.reduce(
    (sum, item) =>
      sum + Math.round((hours[item.id] ?? item.estimatedHours) * Math.round(rate * 100)),
    0,
  );
  const analysisStale =
    !!detail?.analysis &&
    new Date(detail.project.updatedAt).getTime() > new Date(detail.analysis.createdAt).getTime();
  const progressDone = {
    brief: !!detail?.analysis,
    scope: !!activeOrder,
    proposal: activeOrder?.status === 'paid',
    activity: false,
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="nav-label">YOUR WORKSPACE</div>
        <button
          className={`nav-item ${!showProjectList && stage !== 'activity' ? 'active' : ''}`}
          onClick={() => {
            setShowProjectList(false);
            setStage('brief');
          }}
        >
          <FolderOpen size={15} /> Overview
        </button>
        <button
          className={`nav-item ${showProjectList ? 'active' : ''}`}
          onClick={() => setShowProjectList(true)}
        >
          <FileText size={15} /> Projects <span className="count">{projects.length}</span>
        </button>
        <button
          className={`nav-item ${stage === 'activity' && !showProjectList ? 'active' : ''}`}
          onClick={() => {
            setShowProjectList(false);
            setStage('activity');
          }}
        >
          <History size={15} /> Payment activity
        </button>
        <div className="nav-label" style={{ marginTop: 35 }}>
          ACTIVE PROJECTS
        </div>
        <div className="project-nav">
          {projects.slice(0, 6).map((item) => (
            <button
              key={item.id}
              className={projectId === item.id && !showProjectList ? 'active' : ''}
              onClick={() => {
                setProjectId(item.id);
                setShowProjectList(false);
                setStage('brief');
                setActiveOrderId(null);
              }}
            >
              <span className="project-dot" />
              <span className="truncated">{item.title}</span>
            </button>
          ))}
          {!PUBLIC_DEMO && (
            <button onClick={() => setModal('new-project')}>
              <Plus size={12} /> New project
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setModal('guide')}>
            <BookOpen size={14} /> Demo walkthrough{' '}
            <ExternalLink size={10} style={{ marginLeft: 'auto' }} />
          </button>
          <button className="nav-item" onClick={() => setModal('integrations')}>
            <Settings2 size={14} /> Integrations
          </button>
          <div className="sandbox-note">
            <strong>
              <ShieldCheck size={12} /> PayPal sandbox
            </strong>
            {PUBLIC_DEMO ? 'Public sample · no payment calls.' : 'Real API calls. Test money only.'}
          </div>
          <div className="owner">
            <span className="avatar">{initials(project?.freelancerName || 'Your workspace')}</span>
            <div>
              <div className="owner-name">{project?.freelancerName || 'Your workspace'}</div>
              <div className="owner-role">Independent studio</div>
            </div>
            <button
              className="icon-btn"
              title="Workspace integrations"
              onClick={() => setModal('integrations')}
              style={{ marginLeft: 'auto' }}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={10} />
            <span>{showProjectList ? 'All projects' : 'Projects'}</span>
            {project && !showProjectList && (
              <>
                <ChevronRight size={10} />
                <strong className="truncated" style={{ maxWidth: 250 }}>
                  {project.title}
                </strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            <button
              className="connection"
              style={{ border: 0, background: 'none', padding: 0 }}
              onClick={() => setModal('integrations')}
            >
              <span
                className={`connection-dot ${session.integrations.llm.configured ? '' : 'off'}`}
              />
              {PUBLIC_DEMO
                ? 'Prewritten sample'
                : session.integrations.llm.configured
                  ? 'AI connected'
                  : 'AI setup needed'}
            </button>
            <span className="vertical-line" />
            <button
              className="connection"
              style={{ border: 0, background: 'none', padding: 0 }}
              onClick={() => setModal('integrations')}
            >
              <ShieldCheck size={12} /> PayPal sandbox
            </button>
            <button
              className="topbar-help"
              onClick={() => setModal('guide')}
              aria-label="Open demo guide"
            >
              <CircleHelp size={16} />
            </button>
          </div>
        </header>
        <div className="workspace">
          <PublicSampleNotice onStart={analyze} busy={!!busy || !detail} />
          <div className="hero">
            <div>
              <div className="eyebrow">
                <span className="dash" />{' '}
                {showProjectList
                  ? 'A little clarity for every project'
                  : 'Protect your time. Keep the trust.'}
              </div>
              <h1>{showProjectList ? 'Your work, in order.' : 'Make room for the extra.'}</h1>
              <p>
                {showProjectList
                  ? 'Clear agreements. Thoughtful changes. Work that gets paid.'
                  : 'Turn “one small thing” into a clear, paid agreement.'}
              </p>
            </div>
            <div className="hero-actions">
              <Button className="btn-secondary" onClick={() => setModal('guide')}>
                <BookOpen size={13} /> How it works
              </Button>
              {!PUBLIC_DEMO && (
                <Button className="new-project-btn" onClick={() => setModal('new-project')}>
                  <Plus size={13} /> New project
                </Button>
              )}
            </div>
          </div>
          {error && <Alert onClose={() => setError('')}>{error}</Alert>}
          {showProjectList ? (
            <>
              <div className="section-heading">
                <h2>
                  <FolderOpen size={14} /> All projects
                </h2>
                <button className="btn btn-plain btn-sm" onClick={loadExample} disabled={!!busy}>
                  <Sparkles size={11} /> Load example
                </button>
              </div>
              <div className="project-list-cards">
                {projects.map((item) => (
                  <button
                    key={item.id}
                    className="project-select-card"
                    onClick={() => {
                      setProjectId(item.id);
                      setShowProjectList(false);
                      setStage('brief');
                      setActiveOrderId(null);
                    }}
                  >
                    <div className="project-icon">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        {item.clientName} · Created {shortDate(item.createdAt)}
                      </p>
                    </div>
                    <span className="price">{money(item.baseAmountCents)}</span>
                    <ChevronRight size={14} color="#a0ad91" />
                  </button>
                ))}
              </div>
              {!projects.length && (
                <EmptyState
                  icon={<FolderOpen size={20} />}
                  title="A fresh start."
                  text="Add an agreement and a few client requests. We’ll help make the scope clear."
                >
                  <Button onClick={loadExample} busy={busy === 'seed'} className="btn-primary">
                    <Sparkles size={13} /> Open the example project
                  </Button>
                </EmptyState>
              )}
            </>
          ) : !project || detailLoading ? (
            detailLoading ? (
              <div className="loading-skeleton" />
            ) : (
              <div className="welcome-card">
                <div>
                  <div className="eyebrow" style={{ marginBottom: 15 }}>
                    THE NEXT STEP IS CLEAR
                  </div>
                  <h2>Every project starts with an agreement.</h2>
                  <p>
                    Create your first project, or explore a complete example: a $300 landing page, a
                    new mobile-checkout request, and a $120 change order.
                  </p>
                </div>
                <Button onClick={loadExample} busy={busy === 'seed'} className="btn-primary">
                  <Sparkles size={14} /> Explore the example
                </Button>
              </div>
            )
          ) : (
            <>
              <div className="project-summary">
                <div className="project-icon">
                  <FileText size={19} />
                </div>
                <div>
                  <div className="project-name">{project.title}</div>
                  <div className="project-sub">
                    <Users size={11} /> {project.clientName}
                    <span>·</span>
                    <span>{project.clientEmail}</span>
                  </div>
                </div>
                <div className="summary-spacer" />
                <div className="summary-stat hide-small">
                  <div className="label">AGREED ON</div>
                  <div className="value">{shortDate(project.createdAt)}</div>
                </div>
                <div className="summary-stat">
                  <div className="label">ORIGINAL SCOPE</div>
                  <div className="value price">{money(project.baseAmountCents)}</div>
                </div>
                <div className="summary-stat hide-mobile">
                  <div className="label">PROJECT STATUS</div>
                  <span className="status">In progress</span>
                </div>
              </div>
              <nav className="stage-nav" aria-label="Project stages">
                {stages.map((item, index) => (
                  <button
                    key={item.id}
                    className={`stage-tab ${stage === item.id ? 'active' : ''} ${progressDone[item.id] ? 'done' : ''}`}
                    onClick={() => setStage(item.id)}
                  >
                    <span className="stage-num">
                      {progressDone[item.id] ? <Check size={9} /> : index + 1}
                    </span>
                    {item.label}
                  </button>
                ))}
              </nav>
              {stage === 'brief' && (
                <>
                  <div className="workspace-columns">
                    <div>
                      <div className="section-heading">
                        <h2>
                          <FileText size={13} /> The original agreement
                        </h2>
                        <span className="section-meta">Your source of truth</span>
                      </div>
                      <div className="paper">
                        <div className="document-toolbar">
                          <span className="document-type">
                            <FileCheck2 size={12} /> PROJECT BRIEF
                          </span>
                          <span>Agreed scope</span>
                        </div>
                        <div className="document-body">{project.brief}</div>
                        <div className="document-footer">
                          <span className="inline-note">
                            <LockKeyhole size={10} /> Preserved for every change order
                          </span>
                          <span>{project.brief.split(/\s+/).length} words</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="section-heading">
                        <h2>
                          <MessageSquareText size={13} /> The conversation
                        </h2>
                        <span className="request-count">
                          {project.messages.length} request
                          {project.messages.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="paper">
                        <div className="request-thread">
                          {project.messages.length ? (
                            project.messages.map((message) => (
                              <div className="message" key={message.id}>
                                <div className="message-top">
                                  <div className="message-avatar">{initials(message.author)}</div>
                                  <span className="message-author">{message.author}</span>
                                  <span className="message-time">
                                    {shortDate(message.createdAt)}
                                  </span>
                                </div>
                                <div className="message-body">{message.text}</div>
                              </div>
                            ))
                          ) : (
                            <div
                              style={{
                                padding: '25px 0',
                                fontSize: 11,
                                color: '#94a185',
                                lineHeight: 1.8,
                              }}
                            >
                              Add the client requests you would like to compare with the agreement.
                            </div>
                          )}
                        </div>
                        {!PUBLIC_DEMO && (
                          <form className="message-add" onSubmit={addMessage}>
                            <label className="screen-reader" htmlFor="new-message">
                              Add a client request
                            </label>
                            <textarea
                              id="new-message"
                              placeholder="Paste a new client request…"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              maxLength={12000}
                            />
                            <div className="message-add-bottom">
                              <small>Keep the wording as your client sent it.</small>
                              <Button
                                className="btn-secondary btn-sm"
                                type="submit"
                                disabled={!newMessage.trim() || !!busy}
                                busy={busy === 'message'}
                              >
                                <Plus size={11} /> Add request
                              </Button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="analysis-cta">
                    <div className="analysis-cta-icon">
                      <Sparkles size={19} />
                    </div>
                    <div className="analysis-cta-copy">
                      <h3>A little clarity before the next “yes.”</h3>
                      <p>
                        Compare requests with your agreement. Keep included work separate from new
                        scope.
                      </p>
                    </div>
                    <div className="mode-switch">
                      <label htmlFor="analysis-mode" className="screen-reader">
                        Analysis mode
                      </label>
                      <select
                        id="analysis-mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as 'live' | 'sample')}
                      >
                        <option value="live" disabled={!session.integrations.llm.configured}>
                          Live AI
                        </option>
                        <option value="sample">Sample analysis</option>
                      </select>
                    </div>
                    <Button
                      onClick={analyze}
                      busy={busy === 'analyze'}
                      disabled={!project.messages.length || !!busy}
                    >
                      <Sparkles size={13} />{' '}
                      {busy === 'analyze'
                        ? 'Reading the details…'
                        : detail?.analysis
                          ? 'Review scope again'
                          : 'Review the scope'}
                      {busy !== 'analyze' && <ArrowRight size={13} />}
                    </Button>
                  </div>
                  {detail?.analysis && (
                    <div className="mini-callout">
                      <CheckCircle2 size={13} />
                      <span>
                        Your last review is ready.{' '}
                        <button
                          style={{
                            background: 'none',
                            color: '#5c783e',
                            padding: 0,
                            fontSize: 'inherit',
                            textDecoration: 'underline',
                          }}
                          onClick={() => setStage('scope')}
                        >
                          View scope review
                        </button>{' '}
                        · {detail.analysis.mode === 'sample' ? 'Sample analysis' : 'Live AI'} ·{' '}
                        {dateTime(detail.analysis.createdAt)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {stage === 'scope' &&
                (detail?.analysis ? (
                  <>
                    <div className="analysis-banner">
                      <div className="analysis-banner-icon">
                        <Sparkles size={19} />
                      </div>
                      <div>
                        <h2>
                          {
                            detail.analysis.items.filter((i) => i.classification === 'change')
                              .length
                          }{' '}
                          scope change
                          {detail.analysis.items.filter((i) => i.classification === 'change')
                            .length === 1
                            ? ''
                            : 's'}
                          , with the evidence to explain.
                        </h2>
                        <p>{detail.analysis.summary}</p>
                      </div>
                      <div className="analysis-value">
                        <strong>{money(totalCents)}</strong>
                        <span>PROPOSED ADDITIONAL WORK</span>
                      </div>
                    </div>
                    <div className="section-heading">
                      <h2>
                        <ClipboardCheck size={13} /> A fair review, request by request
                      </h2>
                      <span className="mode-chip">
                        {detail.analysis.mode === 'sample' ? (
                          <>
                            <Info size={10} /> Sample analysis
                          </>
                        ) : (
                          <>
                            <Sparkles size={10} /> Live AI analysis
                          </>
                        )}
                      </span>
                    </div>
                    {analysisStale && (
                      <Alert type="info">
                        The project changed after this review.{' '}
                        <button
                          style={{
                            background: 'none',
                            color: 'inherit',
                            padding: 0,
                            textDecoration: 'underline',
                            fontSize: 'inherit',
                          }}
                          onClick={analyze}
                          disabled={!!busy}
                        >
                          Review the latest scope
                        </button>{' '}
                        before drafting a new proposal.
                      </Alert>
                    )}
                    {detail.analysis.mode === 'sample' && (
                      <div className="analysis-subtitle">
                        This is the example analysis. Run Live AI to evaluate your own project and
                        messages.
                      </div>
                    )}
                    <div className="scope-view-switch" role="group" aria-label="Scope review view">
                      <button
                        aria-pressed={scopeView === 'cards'}
                        onClick={() => setScopeView('cards')}
                      >
                        <ClipboardCheck size={12} /> Request cards
                      </button>
                      <button
                        aria-pressed={scopeView === 'ledger'}
                        onClick={() => setScopeView('ledger')}
                      >
                        <FileText size={12} /> Evidence ledger
                      </button>
                      <span>One review. The same selection and price.</span>
                    </div>
                    <div className={`review-grid ${scopeView === 'ledger' ? 'ledger-layout' : ''}`}>
                      <div className="scope-list">
                        {scopeView === 'ledger' ? (
                          <Suspense
                            fallback={
                              <p className="analysis-subtitle" role="status">
                                Opening the evidence ledger…
                              </p>
                            }
                          >
                            <ScopeLedger
                              items={detail.analysis.items}
                              selectedIds={selectedItems}
                              hours={hours}
                              rate={rate}
                              onSelectionChange={setSelectedItems}
                              onHoursChange={(id, value) =>
                                setHours((previous) => ({ ...previous, [id]: value }))
                              }
                            />
                          </Suspense>
                        ) : (
                          detail.analysis.items.map((item) => (
                            <ScopeItem
                              key={item.id}
                              item={item}
                              selected={selectedItems.includes(item.id)}
                              onSelect={() =>
                                setSelectedItems((previous) =>
                                  previous.includes(item.id)
                                    ? previous.filter((id) => id !== item.id)
                                    : [...previous, item.id],
                                )
                              }
                              hours={hours[item.id] ?? item.estimatedHours}
                              rate={rate}
                              onHours={(value) =>
                                setHours((previous) => ({ ...previous, [item.id]: value }))
                              }
                            />
                          ))
                        )}
                        <p className="analysis-footnote">
                          AI suggests the scope. You decide what to charge. Every quoted source is
                          checked against the original text.
                        </p>
                      </div>
                      <div className="proposal-summary">
                        <div className="paper">
                          <div className="paper-heading">
                            <h3>
                              <FilePlus2 size={14} /> Your change order
                            </h3>
                            <span className="section-meta">{selectedItems.length} selected</span>
                          </div>
                          <div className="paper-body">
                            <div className="summary-section-label">ADDITIONAL WORK</div>
                            {selectedAnalysisItems.length ? (
                              selectedAnalysisItems.map((item) => (
                                <div className="selected-line" key={item.id}>
                                  <span>{item.title}</span>
                                  <span>
                                    {money(
                                      Math.round(
                                        (hours[item.id] ?? item.estimatedHours) *
                                          Math.round(rate * 100),
                                      ),
                                    )}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="integration-detail">
                                Select additional work to include in the proposal.
                              </p>
                            )}
                            <div className="inline-edit">
                              <label
                                htmlFor="hourly-rate"
                                style={{ fontSize: 10, fontWeight: 400, margin: 0 }}
                              >
                                Your hourly rate
                              </label>
                              <span>$</span>
                              <input
                                id="hourly-rate"
                                type="number"
                                min="1"
                                max="10000"
                                step="1"
                                value={rate}
                                onChange={(e) => setRate(Number(e.target.value))}
                              />
                              <span>/ hr</span>
                            </div>
                            <div className="subtotal-row">
                              <span>Original agreement</span>
                              <span>{money(project.baseAmountCents)}</span>
                            </div>
                            <div className="subtotal-row">
                              <span>Included adjustments</span>
                              <span>$0</span>
                            </div>
                            <div className="subtotal-row total">
                              <span>Change order total</span>
                              <strong>{money(totalCents)}</strong>
                            </div>
                            <Button
                              className="btn-primary full-btn"
                              style={{ marginTop: 19 }}
                              disabled={
                                !selectedItems.length ||
                                rate <= 0 ||
                                totalCents <= 0 ||
                                analysisStale ||
                                !!busy
                              }
                              busy={busy === 'proposal'}
                              onClick={createProposal}
                            >
                              Draft change order <ArrowRight size={13} />
                            </Button>
                            <p className="summary-help">
                              Nothing is sent or charged yet.
                              <br />
                              You’ll review the proposal first.
                            </p>
                          </div>
                        </div>
                        <div className="mini-callout">
                          <ShieldCheck size={14} />
                          <span>
                            Included work stays included. Clarifications need an answer before they
                            become billable.
                          </span>
                        </div>
                        {activeOrder && (
                          <Button
                            className="btn-plain full-btn"
                            style={{ marginTop: 12 }}
                            onClick={() => setStage('proposal')}
                          >
                            View existing change order <ChevronRight size={12} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<Sparkles size={20} />}
                    title="Let’s read between the lines."
                    text="Add your agreement and client requests, then run a scope review to identify what’s included and what needs a new agreement."
                  >
                    <Button className="btn-primary" onClick={() => setStage('brief')}>
                      <ArrowLeft size={13} /> Back to the brief
                    </Button>
                  </EmptyState>
                ))}
              {stage === 'proposal' &&
                (activeOrder ? (
                  <div className="proposal-layout">
                    <div>
                      <OrderDocument order={activeOrder} project={project} />
                      <details className="paper client-evidence">
                        <summary>
                          Evidence behind this proposal <ChevronDown size={13} />
                        </summary>
                        <div className="paper-body">
                          <EvidenceQuotes
                            evidence={activeOrder.items.flatMap((item) => item.evidence)}
                          />
                        </div>
                      </details>
                    </div>
                    <div className="proposal-summary">
                      <div className="paper">
                        <div className="paper-heading">
                          <h3>
                            <Wallet size={14} /> Agreement & payment
                          </h3>
                          <Status value={activeOrder.status} />
                        </div>
                        <OrderTimeline order={activeOrder} />
                        {activeOrder.clientNote && (
                          <div className="approval-note">
                            <strong>{activeOrder.acceptedBy || 'Client'}:</strong>{' '}
                            {activeOrder.clientNote}
                          </div>
                        )}
                        {activeOrder.invoice && (
                          <div className="payment-proof">
                            <div className="payment-proof-label">
                              <ShieldCheck size={12} /> PayPal sandbox invoice
                            </div>
                            <code>{activeOrder.invoice.id}</code>
                            <div style={{ marginTop: 8, fontSize: 9, color: '#9eac90' }}>
                              PayPal status: {activeOrder.invoice.status}
                              <br />
                              Paid: {money(activeOrder.invoice.paidAmountCents)} of{' '}
                              {money(activeOrder.invoice.amountCents)}
                            </div>
                          </div>
                        )}
                        <div className="payment-actions">
                          {activeOrder.status === 'draft' && (
                            <>
                              <Button
                                className="btn-primary full-btn"
                                onClick={shareOrder}
                                busy={busy === 'share'}
                                disabled={!!busy}
                              >
                                <Send size={13} /> Create client review link
                              </Button>
                              <Button
                                className="btn-secondary full-btn"
                                onClick={() => setModal('edit-proposal')}
                              >
                                <SquarePen size={12} /> Edit proposal
                              </Button>
                              <p className="summary-help">
                                Sharing locks the price and scope.
                                <br />
                                Anyone with this private link can respond. Share it with your
                                client.
                              </p>
                            </>
                          )}
                          {activeOrder.reviewUrl && (
                            <>
                              <div className="share-box">
                                <Link2 size={12} />
                                <span>{activeOrder.reviewUrl}</span>
                                <button
                                  onClick={() => copy(activeOrder.reviewUrl!)}
                                  title="Copy client review link"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                              <a
                                className="btn btn-secondary full-btn"
                                href={activeOrder.reviewUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open client review <ExternalLink size={12} />
                              </a>
                            </>
                          )}
                          {activeOrder.status === 'sent' && (
                            <>
                              <Button
                                className="btn-plain full-btn"
                                busy={busy === 'refresh'}
                                disabled={!!busy}
                                onClick={() =>
                                  run('refresh', async () => {
                                    await loadDetail();
                                    setToast('Client approval status refreshed.');
                                  })
                                }
                              >
                                <RefreshCw size={12} /> Check for client approval
                              </Button>
                              <p className="summary-help">
                                Your client reviews and accepts the scope
                                <br />
                                before an invoice can be created.
                              </p>
                            </>
                          )}
                          {activeOrder.status === 'accepted' && (
                            <>
                              <Button
                                className="btn-primary full-btn"
                                busy={busy === 'invoice'}
                                disabled={!!busy || !session.integrations.paypal.configured}
                                onClick={createInvoice}
                              >
                                <CreditCard size={13} /> Create PayPal invoice
                              </Button>
                              {!session.integrations.paypal.configured && (
                                <p className="summary-help">
                                  {PUBLIC_DEMO
                                    ? 'The public sample stops at approval. Watch the live sandbox payment, or run the full app with your own credentials.'
                                    : 'Connect PayPal sandbox credentials in the server environment to create the invoice.'}
                                </p>
                              )}
                            </>
                          )}
                          {activeOrder.invoice?.paymentUrl &&
                            ['invoiced', 'partially_paid'].includes(activeOrder.status) && (
                              <a
                                className="btn btn-primary full-btn"
                                href={activeOrder.invoice.paymentUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open PayPal sandbox invoice <ExternalLink size={12} />
                              </a>
                            )}
                          {activeOrder.invoice && (
                            <Button
                              className="btn-secondary full-btn"
                              busy={busy === 'sync'}
                              onClick={syncOrder}
                              disabled={!!busy}
                            >
                              <RefreshCw size={12} /> Check payment status
                            </Button>
                          )}
                          {activeOrder.status === 'paid' && (
                            <div className="alert alert-success" style={{ margin: 0 }}>
                              <CheckCircle2 size={16} />
                              <span>
                                Payment confirmed by PayPal.
                                <br />
                                Your additional work is agreed and paid.
                              </span>
                            </div>
                          )}
                          {activeOrder.status === 'declined' && (
                            <p className="summary-help">
                              The client declined this proposal. Review their note and create a
                              revised change order.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mini-callout">
                        <LockKeyhole size={14} />
                        <span>
                          {activeOrder.status === 'draft'
                            ? 'Your original agreement stays intact. This proposal covers only the additional work.'
                            : activeOrder.acceptedAt
                              ? 'The client approved this scope and price. Shared terms stay fixed.'
                              : activeOrder.status === 'sent'
                                ? 'Shared terms stay fixed while your client reviews the scope and price.'
                                : 'The shared proposal remains a record of the scope and price your client reviewed.'}
                        </span>
                      </div>
                      {detail.changeOrders.length > 1 && (
                        <div className="paper" style={{ marginTop: 15 }}>
                          <div className="paper-heading">
                            <h3>Other proposals</h3>
                          </div>
                          <div className="paper-body" style={{ paddingTop: 0, paddingBottom: 10 }}>
                            {detail.changeOrders.map((order) => (
                              <button
                                key={order.id}
                                className="proposal-history-btn"
                                style={{
                                  display: 'flex',
                                  width: '100%',
                                  padding: '13px 0',
                                  borderBottom: '1px solid #eef1e7',
                                  background: 'none',
                                  gap: 10,
                                  textAlign: 'left',
                                  fontSize: 10,
                                  color: '#8c9d79',
                                }}
                                onClick={() => setActiveOrderId(order.id)}
                              >
                                <span className="truncated">{order.title}</span>
                                <span style={{ marginLeft: 'auto' }}>
                                  {money(order.amountCents)}
                                </span>
                                <Status value={order.status} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<FilePlus2 size={20} />}
                    title="A clearer yes starts here."
                    text="Select the additional work in your scope review, set a fair price, and draft a proposal your client can approve."
                  >
                    <Button className="btn-primary" onClick={() => setStage('scope')}>
                      View scope review <ArrowRight size={13} />
                    </Button>
                  </EmptyState>
                ))}
              {stage === 'activity' && (
                <>
                  <div className="section-heading">
                    <h2>
                      <History size={14} /> A record of every agreement
                    </h2>
                    <Button
                      className="btn-secondary btn-sm"
                      onClick={exportEvidence}
                      busy={busy === 'export'}
                    >
                      <ArrowDownToLine size={12} /> Export evidence
                    </Button>
                  </div>
                  <div className="paper">
                    <div className="paper-heading">
                      <h3>
                        <ShieldCheck size={13} /> Project activity
                      </h3>
                      <span className="section-meta">
                        {detail.audit.length} events ·{' '}
                        {PUBLIC_DEMO ? 'browser sample' : 'server recorded'}
                      </span>
                    </div>
                    <AuditList events={detail.audit} />
                  </div>
                </>
              )}
              <div className="footnote">
                <LockKeyhole size={10} /> You agree on the work. Your client agrees on the price.
                PayPal handles the payment.
              </div>
            </>
          )}
        </div>
      </main>
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={14} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === 'new-project'
              ? 'A new agreement.'
              : modal === 'guide'
                ? 'The three-minute walkthrough.'
                : modal === 'integrations'
                  ? 'Your connections.'
                  : 'Fine-tune the proposal.'
          }
          onClose={() => setModal(null)}
        >
          {modal === 'new-project' && (
            <NewProjectForm
              onCancel={() => setModal(null)}
              onCreate={async (project) => {
                await loadProjects(project.id);
                setShowProjectList(false);
                setStage('brief');
                setModal(null);
                setActiveOrderId(null);
                setToast('Project created. Add the client’s requests to begin.');
              }}
            />
          )}
          {modal === 'guide' && (
            <DemoGuide
              onExample={() => {
                setModal(null);
                loadExample();
              }}
              busy={busy === 'seed'}
            />
          )}
          {modal === 'integrations' && <Integrations state={session.integrations} />}
          {modal === 'edit-proposal' && activeOrder && (
            <EditProposal
              order={activeOrder}
              analysis={detail?.analysis || null}
              onCancel={() => setModal(null)}
              onSaved={async () => {
                await loadDetail();
                setModal(null);
                setToast('Draft updated. Your client will see this scope and price.');
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function ScopeItem({
  item,
  selected,
  onSelect,
  hours,
  rate,
  onHours,
}: {
  item: AnalysisItem;
  selected: boolean;
  onSelect: () => void;
  hours: number;
  rate: number;
  onHours: (value: number) => void;
}) {
  const [expanded, setExpanded] = useState(item.classification === 'change');
  const isChange = item.classification === 'change';
  return (
    <article className={`scope-item ${selected ? 'selected' : ''}`}>
      <div className="scope-item-top">
        <input
          className="scope-check"
          type="checkbox"
          aria-label={`Include ${item.title} in change order`}
          checked={selected}
          disabled={!isChange}
          onChange={onSelect}
        />
        <div className="scope-item-main">
          <div className="scope-item-title">
            <span>{item.title}</span>
            <span
              className={`status ${isChange ? 'amber' : item.classification === 'included' ? 'green' : 'blue'}`}
            >
              {isChange
                ? 'New scope'
                : item.classification === 'included'
                  ? 'Already included'
                  : 'Needs clarification'}
            </span>
          </div>
          <p className="scope-item-description">{item.description}</p>
          <div className="scope-item-metadata">
            <span>
              {item.confidence === 'high'
                ? 'High confidence'
                : item.confidence === 'medium'
                  ? 'Review recommended'
                  : 'Needs your review'}
            </span>
            <span>·</span>
            <span>
              {item.evidence.length} source{item.evidence.length === 1 ? '' : 's'}
            </span>
            <strong className="scope-item-price">
              {isChange
                ? money(Math.round(hours * Math.round(rate * 100)))
                : item.classification === 'included'
                  ? '$0'
                  : 'TBD'}
            </strong>
          </div>
        </div>
      </div>
      <button
        className="scope-expand"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span>{expanded ? 'Hide' : 'View'} source evidence</span>
        <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : '' }} />
      </button>
      {expanded && (
        <div className="evidence-area">
          <EvidenceQuotes evidence={item.evidence} />
          <p className="evidence-reason">{item.reason}</p>
          {item.questions.length > 0 && (
            <div className="mini-callout">
              <CircleHelp size={12} />
              <span>{item.questions.join(' ')}</span>
            </div>
          )}
          {isChange && (
            <div className="inline-edit" style={{ marginBottom: 0, justifyContent: 'flex-start' }}>
              <label
                htmlFor={`hours-${item.id}`}
                style={{ margin: 0, fontSize: 10, fontWeight: 400 }}
              >
                Your estimate
              </label>
              <input
                id={`hours-${item.id}`}
                type="number"
                min="0.25"
                max="1000"
                step="0.25"
                value={hours}
                onChange={(e) => onHours(Number(e.target.value))}
                style={{ width: 76, background: '#fff', fontSize: 10, padding: '6px 8px' }}
              />
              <span>hours at {money(Math.round(rate * 100))}/hr</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function OrderDocument({
  order,
  project,
}: {
  order: ChangeOrder;
  project: Pick<
    Project,
    'title' | 'clientName' | 'freelancerName' | 'baseAmountCents' | 'currency'
  >;
}) {
  return (
    <article className="order-document">
      <div className="order-doc-top">
        <div className="order-wordmark">ChangeOrder</div>
        <div className="order-doc-label">
          CHANGE ORDER
          <strong>
            CO-{order.id.slice(-6).toUpperCase()} · v{order.revision}
          </strong>
        </div>
      </div>
      <h2>{order.title}</h2>
      <p className="order-intro">{order.summary}</p>
      <div className="order-parties">
        <div>
          <div className="party-label">PREPARED FOR</div>
          <div className="party-value">
            <strong>{order.clientName || project.clientName}</strong>
            {order.projectTitle || project.title}
          </div>
        </div>
        <div>
          <div className="party-label">PREPARED BY</div>
          <div className="party-value">
            <strong>{order.freelancerName || project.freelancerName}</strong>
            {shortDate(order.createdAt)}
          </div>
        </div>
      </div>
      <table className="order-items">
        <thead>
          <tr>
            <th>Additional work</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="order-item-title">{item.title}</div>
                <div className="order-item-details">{item.description}</div>
                <div className="order-item-details">
                  {item.hours} hour{item.hours === 1 ? '' : 's'} × {money(item.rateCents)} / hour
                </div>
              </td>
              <td>{money(item.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="order-total">
        <span>Additional project fee</span>
        <strong>{money(order.amountCents)}</strong>
      </div>
      <p className="order-note">
        The original {money(order.originalAmountCents ?? project.baseAmountCents)} agreement remains
        in place. This change order covers only the additional work listed above. Client approval
        comes before invoicing. All payments in this demonstration use PayPal’s sandbox and test
        funds.
      </p>
      {order.termsHash && (
        <details className="terms-verification">
          <summary>
            <ShieldCheck size={11} /> Terms locked · Version {order.revision}
            <ChevronDown size={11} />
          </summary>
          <div>
            <p>
              This fingerprint identifies the exact scope and price shared for review. Changing the
              terms requires a new proposal.
            </p>
            <code>{order.termsHash}</code>
          </div>
        </details>
      )}
    </article>
  );
}

function OrderTimeline({ order }: { order: ChangeOrder }) {
  const shared = order.status !== 'draft';
  const accepted = !!order.acceptedAt;
  const invoiced = !!order.invoice;
  const paid = order.status === 'paid';
  const refunded = order.status === 'refunded' || order.status === 'partially_refunded';
  const cancelled = order.status === 'cancelled';
  const steps = [
    {
      label: 'Proposal prepared',
      done: true,
      current: false,
      description: `${money(order.amountCents)} in clearly defined additional work`,
    },
    {
      label: order.status === 'declined' ? 'Client declined' : 'Client approval',
      done: accepted,
      current: shared && !accepted && order.status !== 'declined',
      description: accepted
        ? `${order.acceptedBy || 'Client'} accepted on ${shortDate(order.acceptedAt!)}`
        : order.status === 'declined'
          ? 'Review the client’s note before revising'
          : shared
            ? 'Waiting for your client to review the terms'
            : 'Share a secure link when you’re ready',
    },
    {
      label: 'PayPal invoice',
      done: invoiced,
      current: accepted && !invoiced,
      description: invoiced
        ? order.invoice?.number || 'Created through the PayPal sandbox API'
        : 'Created only after client approval',
    },
    {
      label: refunded
        ? statusText[order.status]
        : cancelled
          ? 'Invoice cancelled'
          : 'Payment confirmed',
      done: paid || refunded || cancelled,
      current: invoiced && !paid && !refunded && !cancelled,
      description: refunded
        ? 'Refund status confirmed with PayPal'
        : cancelled
          ? 'This invoice is no longer payable'
          : paid
            ? `${money(order.invoice?.paidAmountCents || order.amountCents)} confirmed by PayPal`
            : order.status === 'partially_paid'
              ? `${money(order.invoice?.paidAmountCents || 0)} paid so far`
              : 'Verified with PayPal, never assumed',
    },
  ];
  return (
    <div className="timeline">
      {steps.map((item, i) => (
        <div
          className={`timeline-step ${item.done ? 'done' : ''} ${item.current ? 'current' : ''}`}
          key={item.label}
        >
          <div className="timeline-circle">{item.done ? <Check size={11} /> : i + 1}</div>
          <div className="timeline-copy">
            <strong>{item.label}</strong>
            <p>{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditList({ events }: { events: AuditEvent[] }) {
  if (!events.length)
    return (
      <div className="paper-body integration-detail">
        Activity will appear here as this project progresses.
      </div>
    );
  return (
    <div className="audit-list">
      {events.map((event) => (
        <div className="audit-item" key={event.id}>
          <div className="audit-symbol">
            {event.type.includes('paid') || event.type.includes('payment') ? (
              <CreditCard size={13} />
            ) : event.type.includes('analy') ? (
              <Sparkles size={13} />
            ) : event.type.includes('accept') ? (
              <CheckCircle2 size={13} />
            ) : event.type.includes('share') ? (
              <Send size={12} />
            ) : (
              <FileText size={13} />
            )}
          </div>
          <div className="audit-copy">
            <h3>{event.title}</h3>
            <p>{event.detail}</p>
            <span className="audit-hash">
              {event.actor} · {event.type}
            </span>
          </div>
          <time className="audit-time" dateTime={event.createdAt}>
            {dateTime(event.createdAt)}
          </time>
        </div>
      ))}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const preferred = dialog.current?.querySelector<HTMLElement>('input, textarea, select, button');
    preferred?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ) || [],
      );
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handler);
      previousFocus?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: (data: SessionState) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSuccess(await post<SessionState>('/session', { accessCode: code }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the workspace.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div>
          <div className="eyebrow" style={{ marginBottom: 19 }}>
            FOR THE WORK THAT GROWS
          </div>
          <h1>
            Good work.
            <br />
            Clear agreements.
            <br />
            Better together.
          </h1>
          <p>
            A thoughtful way to handle the extra requests. Compare the scope, agree on the price,
            and get paid with PayPal.
          </p>
        </div>
        <div className="login-story-footer">
          Built for independent people and the clients who trust them.
        </div>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <div className="eyebrow">
            <span className="dash" /> YOUR WORKSPACE
          </div>
          <h2>A little clarity awaits.</h2>
          <p>Enter your workspace access code to review projects and prepare change orders.</p>
          <form onSubmit={submit}>
            <label htmlFor="access-code">Workspace access code</label>
            <input
              id="access-code"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Your private access code"
              required
            />
            <Button className="btn-primary full-btn" type="submit" busy={busy}>
              Open workspace <ArrowRight size={13} />
            </Button>
            {error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}
          </form>
          <div className="login-security">
            <LockKeyhole size={12} /> Client review links open separately.
            <br />
            Your workspace and API credentials stay private.
          </div>
        </div>
      </div>
    </div>
  );
}

function NewProjectForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (project: Project) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const { project } = await post<{ project: Project }>('/projects', {
        title: form.get('title'),
        clientName: form.get('clientName'),
        clientEmail: form.get('clientEmail'),
        freelancerName: form.get('freelancerName'),
        brief: form.get('brief'),
        baseAmountCents: Math.round(Number(form.get('baseAmount')) * 100),
        hourlyRateCents: Math.round(Number(form.get('hourlyRate')) * 100),
      });
      await onCreate(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the project.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <p className="modal-subtitle">
        Start with what you and your client agreed. You can add their new requests in the workspace.
      </p>
      {error && <Alert>{error}</Alert>}
      <div className="form-field">
        <label htmlFor="project-title">Project name</label>
        <input
          id="project-title"
          name="title"
          placeholder="e.g. Northstar landing page"
          required
          maxLength={160}
          autoFocus
        />
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="client-name">Client name</label>
          <input
            id="client-name"
            name="clientName"
            required
            maxLength={120}
            placeholder="Mira Chen"
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-email">Client email</label>
          <input
            id="client-email"
            name="clientEmail"
            type="email"
            required
            placeholder="Use a sandbox buyer email"
          />
          <small>For this demo, use a PayPal sandbox buyer.</small>
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="freelancer-name">Your name or studio</label>
        <input
          id="freelancer-name"
          name="freelancerName"
          required
          maxLength={120}
          placeholder="Alex Morgan Studio"
        />
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="base-amount">Original project fee (USD)</label>
          <input
            id="base-amount"
            name="baseAmount"
            type="number"
            min="1"
            max="1000000"
            step="0.01"
            defaultValue="300"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="hourly-rate-new">Your hourly rate (USD)</label>
          <input
            id="hourly-rate-new"
            name="hourlyRate"
            type="number"
            min="1"
            max="10000"
            step="0.01"
            defaultValue="60"
            required
          />
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="project-brief">Original agreement or project brief</label>
        <textarea
          id="project-brief"
          name="brief"
          required
          minLength={20}
          maxLength={30000}
          style={{ minHeight: 160 }}
          placeholder="Paste the agreed deliverables, revision limits, exclusions, and price. The exact wording helps make a fair comparison."
        />
      </div>
      <div className="modal-actions">
        <Button className="btn-secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="btn-primary" type="submit" busy={busy}>
          Create project <ArrowRight size={12} />
        </Button>
      </div>
    </form>
  );
}

function EditProposal({
  order,
  analysis,
  onCancel,
  onSaved,
}: {
  order: ChangeOrder;
  analysis: Analysis | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(order.title);
  const [lines, setLines] = useState(
    order.items.map((item) => ({ ...item, analysisItemId: item.id })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = lines.reduce((sum, item) => sum + Math.round(item.hours * item.rateCents), 0);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/change-orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          items: lines.map((item) => ({
            analysisItemId: item.analysisItemId,
            hours: item.hours,
            rateCents: item.rateCents,
          })),
        }),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the proposal.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <p className="modal-subtitle">
        Set the price you’re comfortable proposing. The client will approve these exact terms.
      </p>
      {error && <Alert>{error}</Alert>}
      <div className="form-field">
        <label htmlFor="proposal-title">Proposal title</label>
        <input
          id="proposal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={160}
        />
      </div>
      {lines.map((item, index) => (
        <div
          key={item.id}
          style={{ paddingTop: 16, borderTop: '1px solid #e4ebda', marginBottom: 16 }}
        >
          <h3 style={{ fontSize: 12, marginBottom: 14 }}>{item.title}</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor={`edit-hours-${index}`}>Estimated hours</label>
              <input
                id={`edit-hours-${index}`}
                type="number"
                min="0.25"
                max="1000"
                step="0.25"
                value={item.hours}
                onChange={(e) =>
                  setLines((previous) =>
                    previous.map((line, i) =>
                      i === index ? { ...line, hours: Number(e.target.value) } : line,
                    ),
                  )
                }
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor={`edit-rate-${index}`}>Hourly rate (USD)</label>
              <input
                id={`edit-rate-${index}`}
                type="number"
                min="1"
                max="10000"
                step="0.01"
                value={item.rateCents / 100}
                onChange={(e) =>
                  setLines((previous) =>
                    previous.map((line, i) =>
                      i === index
                        ? { ...line, rateCents: Math.round(Number(e.target.value) * 100) }
                        : line,
                    ),
                  )
                }
                required
              />
            </div>
          </div>
        </div>
      ))}
      <div className="subtotal-row total">
        <span>Change order total</span>
        <strong>{money(total)}</strong>
      </div>
      <div className="modal-actions">
        <Button className="btn-secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="btn-primary" type="submit" busy={busy}>
          Save draft <Check size={12} />
        </Button>
      </div>
    </form>
  );
}

function DemoGuide({ onExample, busy }: { onExample: () => void; busy: boolean }) {
  const steps = [
    [
      'The original agreement',
      'A $300 landing-page project includes desktop design and two rounds of copy revisions. The client sends three requests.',
    ],
    [
      'A fair scope review',
      'AI separates a new mobile checkout from an included copy correction and a request that needs clarification. Exact source quotes explain each decision.',
    ],
    [
      'A clear proposal',
      'Select the extra work and review the estimate: 2 hours at $60 per hour. Create the $120 change order.',
    ],
    [
      'Client approval',
      'Create a review link. Open it in a separate tab as the client, inspect the evidence, and accept the exact proposal.',
    ],
    [
      'Real sandbox invoicing',
      PUBLIC_DEMO
        ? 'The public sample stops at approval. Watch the recorded real sandbox payment, or run the full app with your own PayPal sandbox credentials.'
        : 'Return to the workspace, refresh approval, and create the PayPal invoice. Pay it with a sandbox buyer account, then check payment status.',
    ],
  ];
  return (
    <>
      <p className="modal-subtitle">
        One small request. A fair conversation. A payment both sides understand.
      </p>
      <div className="guide-list">
        {steps.map(([title, text], index) => (
          <div className="guide-step" key={title}>
            <span>{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="guide-rule">
        <ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} /> All payments
        use PayPal sandbox test funds. Sample analysis is clearly marked. Live AI uses the server’s
        configured model gateway.
      </div>
      <div className="modal-actions">
        <Button className="btn-primary" onClick={onExample} busy={busy}>
          <Sparkles size={12} /> Open example project
        </Button>
      </div>
    </>
  );
}

function Integrations({ state }: { state: IntegrationState }) {
  return (
    <>
      <p className="modal-subtitle">
        {PUBLIC_DEMO
          ? 'This public sample has no credentials and makes no AI or PayPal calls. The full app keeps private credentials on the server.'
          : 'Private credentials stay on the server. Your browser receives only connection status.'}
      </p>
      <div className="integration-list">
        <div className="integration-row">
          <div className="integration-row-icon">
            <Sparkles size={16} />
          </div>
          <div className="integration-row-copy">
            <strong>AI scope analysis</strong>
            <span>
              {state.llm.provider} · {state.llm.model || 'Model not configured'}
            </span>
          </div>
          <span className={`status ${state.llm.configured ? 'green' : 'amber'}`}>
            {state.llm.configured ? 'Configured' : 'Setup needed'}
          </span>
        </div>
        <div className="integration-row">
          <div className="integration-row-icon">
            <CreditCard size={16} />
          </div>
          <div className="integration-row-copy">
            <strong>PayPal invoicing</strong>
            <span>Sandbox environment · test funds only</span>
          </div>
          <span className={`status ${state.paypal.configured ? 'green' : 'amber'}`}>
            {state.paypal.configured ? 'Configured' : 'Setup needed'}
          </span>
        </div>
        <div className="integration-row">
          <div className="integration-row-icon">
            <Bell size={16} />
          </div>
          <div className="integration-row-copy">
            <strong>Payment webhooks</strong>
            <span>
              {state.paypal.webhookConfigured
                ? 'Incoming events require PayPal signature verification'
                : 'Payment status can still be checked directly with PayPal'}
            </span>
          </div>
          <span className={`status ${state.paypal.webhookConfigured ? 'green' : 'amber'}`}>
            {state.paypal.webhookConfigured ? 'Configured' : 'Manual sync'}
          </span>
        </div>
      </div>
      <div className="guide-rule">
        Configuration status does not prove a credential is valid. Live analysis and invoice
        creation verify the connection when they run. No invoice is created without client approval.
      </div>
    </>
  );
}

function ClientReview({ token }: { token: string }) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState(false);
  const load = useCallback(async () => {
    const result = await api<ReviewDetail>(`/review/${encodeURIComponent(token)}`);
    setDetail(result);
    setName((previous) => previous || result.project.clientName);
    return result;
  }, [token]);
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  const decide = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post(`/review/${encodeURIComponent(token)}/decision`, {
        decision: declining ? 'decline' : 'accept',
        name: name.trim(),
        note: note.trim() || undefined,
        termsHash: detail?.changeOrder.termsHash,
      });
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Your decision could not be recorded. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      if (detail?.changeOrder.invoice) await post(`/review/${encodeURIComponent(token)}/sync`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh the status.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="review-page">
      <header className="review-topbar">
        <Brand />
        <span className="secure-label">
          <LockKeyhole size={12} /> {PUBLIC_DEMO ? 'Sample client review' : 'Private client review'}
        </span>
      </header>
      <main className="review-content">
        <PublicSampleNotice />
        {loading ? (
          <div className="loading-page" style={{ minHeight: 400 }}>
            <LoaderCircle size={17} className="spin" /> Opening your proposal…
          </div>
        ) : !detail ? (
          <EmptyState
            icon={<Link2 size={21} />}
            title="This link needs another look."
            text={
              error ||
              'We couldn’t find this change order. Ask your freelancer for the latest review link.'
            }
          >
            <Button className="btn-secondary" onClick={() => window.location.reload()}>
              <RefreshCw size={12} /> Try again
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="review-welcome">
              <div className="eyebrow">
                <span className="dash" /> A CLEAR NEXT STEP
              </div>
              <h1>
                {detail.changeOrder.acceptedAt
                  ? 'A little more work. All agreed.'
                  : 'A clear proposal for the extra work.'}
              </h1>
              <p>
                {detail.project.freelancerName} has prepared a proposal for the additional work on{' '}
                {detail.project.title}.
              </p>
            </div>
            {error && <Alert onClose={() => setError('')}>{error}</Alert>}
            {detail.changeOrder.acceptedAt && (
              <div className="accepted-banner">
                <CheckCircle2 size={24} />
                <div>
                  <h3>Thank you, {detail.changeOrder.acceptedBy}. The scope is agreed.</h3>
                  <p>
                    {detail.changeOrder.status === 'paid'
                      ? 'PayPal has confirmed your payment. Your freelancer has the same record.'
                      : ['refunded', 'partially_refunded'].includes(detail.changeOrder.status)
                        ? 'PayPal has confirmed a refund update. The current status appears below.'
                        : detail.changeOrder.status === 'cancelled'
                          ? 'The invoice has been cancelled. No payment is requested.'
                          : detail.changeOrder.invoice
                            ? 'Your invoice is ready below. PayPal will confirm the payment.'
                            : 'Your freelancer can now prepare the PayPal invoice for this exact amount.'}
                  </p>
                </div>
              </div>
            )}
            <div className="proposal-layout">
              <div>
                <OrderDocument order={detail.changeOrder} project={detail.project} />
                <details className="paper client-evidence" open>
                  <summary>
                    Why this is additional work <ChevronDown size={13} />
                  </summary>
                  <div className="paper-body">
                    <EvidenceQuotes evidence={detail.evidence} />
                  </div>
                </details>
              </div>
              <aside>
                <div className="paper">
                  <div className="paper-heading">
                    <h3>
                      <ClipboardCheck size={14} /> Your decision
                    </h3>
                    <Status value={detail.changeOrder.status} />
                  </div>
                  {detail.changeOrder.status === 'sent' ? (
                    <form className="review-decision" onSubmit={decide}>
                      <h3>{declining ? 'A conversation comes first.' : 'Does this look right?'}</h3>
                      <p>
                        {declining
                          ? 'Leave a note so your freelancer can understand what needs to change.'
                          : `You’re approving ${money(detail.changeOrder.amountCents)} for only the additional work listed here. You’ll pay separately through PayPal.`}
                      </p>
                      <div className="form-field">
                        <label htmlFor="review-name">Your name</label>
                        <input
                          id="review-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          minLength={2}
                          maxLength={120}
                          autoComplete="name"
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor="review-note">
                          {declining
                            ? 'What would you like to change?'
                            : 'A note for your freelancer (optional)'}
                        </label>
                        <textarea
                          id="review-note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder={
                            declining
                              ? 'Please clarify the proposed work…'
                              : 'Looks good. Thanks for laying this out.'
                          }
                          maxLength={2000}
                          required={declining}
                        />
                      </div>
                      <div className="client-warning">
                        <Info size={11} style={{ verticalAlign: 'middle', marginRight: 5 }} />{' '}
                        Sandbox demonstration. This records a test approval and does not charge real
                        money.
                      </div>
                      <Button
                        type="submit"
                        className={`${declining ? 'btn-danger' : 'btn-primary'} full-btn`}
                        busy={busy}
                      >
                        {declining ? <MessageSquareText size={13} /> : <CheckCircle2 size={13} />}
                        {declining
                          ? 'Request a revision'
                          : `Approve ${money(detail.changeOrder.amountCents)} change order`}
                      </Button>
                      <button
                        type="button"
                        className="decline-link"
                        onClick={() => setDeclining(!declining)}
                      >
                        {declining ? 'Go back to approval' : 'I’d like to discuss this first'}
                      </button>
                      <div className="payment-secure">
                        <LockKeyhole size={10} /> Your approval is recorded with these exact terms.
                      </div>
                    </form>
                  ) : (
                    <>
                      <OrderTimeline order={detail.changeOrder} />
                      {detail.changeOrder.clientNote && (
                        <div className="approval-note">
                          <strong>Your note:</strong> {detail.changeOrder.clientNote}
                        </div>
                      )}
                      {detail.changeOrder.invoice?.paymentUrl &&
                        ['invoiced', 'partially_paid'].includes(detail.changeOrder.status) && (
                          <div className="client-invoice-link">
                            <h3>Your PayPal invoice is ready.</h3>
                            <p>
                              Use a PayPal sandbox buyer account. This demonstration uses test
                              funds.
                            </p>
                            <a
                              className="btn btn-primary full-btn"
                              href={detail.changeOrder.invoice.paymentUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Pay{' '}
                              {money(
                                Math.max(
                                  0,
                                  detail.changeOrder.amountCents -
                                    (detail.changeOrder.invoice?.paidAmountCents || 0),
                                ),
                              )}{' '}
                              in PayPal sandbox <ExternalLink size={12} />
                            </a>
                          </div>
                        )}
                      {detail.changeOrder.status === 'paid' && (
                        <div className="alert alert-success" style={{ margin: '0 20px 20px' }}>
                          <CheckCircle2 size={15} />
                          <span>
                            {money(
                              detail.changeOrder.invoice?.paidAmountCents ||
                                detail.changeOrder.amountCents,
                            )}{' '}
                            payment confirmed by PayPal.
                          </span>
                        </div>
                      )}
                      <div className="payment-actions">
                        <Button className="btn-secondary full-btn" busy={busy} onClick={refresh}>
                          <RefreshCw size={12} /> Refresh status
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                <div className="mini-callout">
                  <ShieldCheck size={14} />
                  <span>
                    The original project agreement stays intact. This proposal covers the clearly
                    listed additions.
                  </span>
                </div>
              </aside>
            </div>
            <p className="review-disclaimer">
              This private link grants access only to this proposal. Keep it between you and your
              freelancer. ChangeOrder uses AI to help explain scope. People approve the agreement
              and PayPal confirms the payment.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
