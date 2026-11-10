import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Analysis, AuditEvent, ChangeOrder, Project } from './types.js';

type Stored = Project | Analysis | ChangeOrder;
export class Store {
  private db: DatabaseSync;
  constructor(path = process.env.DATABASE_PATH || './data/changeorder.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL,id TEXT NOT NULL,project_id TEXT NOT NULL,payload TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,order_id TEXT,created_at TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY,received_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS doc_project ON documents(kind,project_id);
      CREATE INDEX IF NOT EXISTS audit_project ON audit(project_id,created_at);`);
  }
  close() {
    this.db.close();
  }
  get<T extends Stored>(kind: string, id: string): T | null {
    const row = this.db
      .prepare('SELECT payload FROM documents WHERE kind=? AND id=?')
      .get(kind, id) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as T) : null;
  }
  list<T extends Stored>(kind: string, projectId?: string): T[] {
    const rows = (
      projectId
        ? this.db
            .prepare('SELECT payload FROM documents WHERE kind=? AND project_id=? ORDER BY rowid')
            .all(kind, projectId)
        : this.db.prepare('SELECT payload FROM documents WHERE kind=? ORDER BY rowid').all(kind)
    ) as { payload: string }[];
    return rows.map((row) => JSON.parse(row.payload) as T);
  }
  put(kind: string, value: Stored) {
    this.db
      .prepare(
        'INSERT INTO documents(kind,id,project_id,payload) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload',
      )
      .run(
        kind,
        value.id,
        'projectId' in value ? value.projectId : value.id,
        JSON.stringify(value),
      );
  }
  project(id: string) {
    return this.get<Project>('project', id);
  }
  analysis(id: string) {
    return this.get<Analysis>('analysis', id);
  }
  order(id: string) {
    return this.get<ChangeOrder>('order', id);
  }
  latestAnalysis(projectId: string) {
    return this.list<Analysis>('analysis', projectId).at(-1) || null;
  }
  orderByToken(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    return this.list<ChangeOrder>('order').find((order) => order.reviewToken === token) || null;
  }
  orderByInvoice(invoiceId: string) {
    return this.list<ChangeOrder>('order').find((order) => order.invoice?.id === invoiceId) || null;
  }
  audit(projectId: string, input: Omit<AuditEvent, 'id' | 'projectId' | 'createdAt'>) {
    const event: AuditEvent = {
      id: randomUUID(),
      projectId,
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.db
      .prepare('INSERT INTO audit(id,project_id,order_id,created_at,payload) VALUES(?,?,?,?,?)')
      .run(
        event.id,
        projectId,
        event.changeOrderId || null,
        event.createdAt,
        JSON.stringify(event),
      );
    return event;
  }
  events(projectId: string) {
    return (
      this.db
        .prepare('SELECT payload FROM audit WHERE project_id=? ORDER BY rowid DESC')
        .all(projectId) as { payload: string }[]
    ).map((row) => JSON.parse(row.payload) as AuditEvent);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  hasWebhook(id: string) {
    return Boolean(this.db.prepare('SELECT id FROM webhook_events WHERE id=?').get(id));
  }
  recordWebhook(id: string) {
    this.db
      .prepare('INSERT OR IGNORE INTO webhook_events(id,received_at) VALUES(?,?)')
      .run(id, new Date().toISOString());
  }
}
