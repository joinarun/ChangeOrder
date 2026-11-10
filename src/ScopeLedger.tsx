import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, CircleHelp, Plus, Search, ShieldCheck, SquarePen } from 'lucide-react';
import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ExternalFilterModule,
  NumberEditorModule,
  NumberFilterModule,
  QuickFilterModule,
  RenderApiModule,
  RowApiModule,
  RowSelectionModule,
  TextFilterModule,
  themeQuartz,
  type CellEditRequestEvent,
  type ColDef,
  type GridApi,
  type ICellRendererParams,
  type IRowNode,
  type RowSelectionOptions,
  type SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import type { AnalysisItem, Classification } from '../server/types';
import './scope-ledger.css';

export interface ScopeLedgerProps {
  items: AnalysisItem[];
  selectedIds: string[];
  hours: Record<string, number>;
  rate: number;
  onSelectionChange(ids: string[]): void;
  onHoursChange(id: string, hours: number): void;
}

interface LedgerRow extends AnalysisItem {
  reviewedHours: number;
  amountCents: number;
}

const modules = [
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowSelectionModule,
  ExternalFilterModule,
  QuickFilterModule,
  TextFilterModule,
  NumberFilterModule,
  NumberEditorModule,
  CellStyleModule,
  RenderApiModule,
  RowApiModule,
];
const ledgerTheme = themeQuartz.withParams({
  accentColor: '#39745c',
  backgroundColor: '#ffffff',
  foregroundColor: '#1c2a35',
  borderColor: '#e6e6df',
  headerBackgroundColor: '#f6f5f0',
  headerTextColor: '#66736e',
  rowHoverColor: '#f8faf7',
  selectedRowBackgroundColor: '#edf5ee',
  fontFamily: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  fontSize: 12,
  headerFontSize: 11,
  headerFontWeight: 600,
  spacing: 6,
  wrapperBorderRadius: 0,
  cellHorizontalPadding: 13,
});
const labels: Record<Classification, string> = {
  change: 'Additional work',
  included: 'Included',
  clarification: 'Clarify first',
};
const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

function ClassificationBadge({ value }: { value: Classification }) {
  const Icon = value === 'change' ? Plus : value === 'included' ? Check : CircleHelp;
  return (
    <span className={`scope-ledger-badge scope-ledger-badge-${value}`}>
      <Icon size={12} aria-hidden="true" />
      {labels[value]}
    </span>
  );
}

export function ScopeLedger({
  items,
  selectedIds,
  hours,
  rate,
  onSelectionChange,
  onHoursChange,
}: ScopeLedgerProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [classification, setClassification] = useState<Classification | 'all'>('all');
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const [gridApi, setGridApi] = useState<GridApi<LedgerRow> | null>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [visibleSelected, setVisibleSelected] = useState(0);
  const [editError, setEditError] = useState('');
  const synchronizingSelection = useRef(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rateCents = Math.round(rate * 100);
  const rowData = useMemo<LedgerRow[]>(
    () =>
      items.map((item) => {
        const reviewedHours =
          item.classification === 'change' ? (hours[item.id] ?? item.estimatedHours) : 0;
        return {
          ...item,
          reviewedHours,
          amountCents: item.classification === 'change' ? Math.round(reviewedHours * rateCents) : 0,
        };
      }),
    [items, hours, rateCents],
  );
  const selectedRows = rowData.filter(
    (row) => row.classification === 'change' && selected.has(row.id),
  );
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amountCents, 0);
  const active = items.find((item) => item.id === activeId) ?? items[0];

  const updateVisibleCounts = useCallback(
    (api: GridApi<LedgerRow>) => {
      let count = 0;
      let selectedCount = 0;
      api.forEachNodeAfterFilter((node) => {
        count++;
        if (node.data?.classification === 'change' && selected.has(node.data.id)) selectedCount++;
      });
      setVisibleCount(count);
      setVisibleSelected(selectedCount);
    },
    [selected],
  );
  const syncSelection = useCallback(
    (api: GridApi<LedgerRow>) => {
      if (api.isDestroyed()) return;
      synchronizingSelection.current = true;
      try {
        api.forEachNode((node) => {
          const shouldSelect = Boolean(
            node.data?.classification === 'change' && selected.has(node.data.id),
          );
          if (node.isSelected() !== shouldSelect) node.setSelected(shouldSelect);
        });
      } finally {
        synchronizingSelection.current = false;
      }
      updateVisibleCounts(api);
    },
    [selected, updateVisibleCounts],
  );
  useEffect(() => {
    if (gridApi && !gridApi.isDestroyed()) syncSelection(gridApi);
  }, [gridApi, rowData, syncSelection]);
  useEffect(() => {
    if (gridApi && !gridApi.isDestroyed()) gridApi.onFilterChanged();
  }, [gridApi, classification]);

  const selectionOptions = useMemo<RowSelectionOptions<LedgerRow>>(
    () => ({
      mode: 'multiRow',
      isRowSelectable: (node) => node.data?.classification === 'change',
      checkboxes: true,
      hideDisabledCheckboxes: false,
      headerCheckbox: true,
      selectAll: 'filtered',
      enableClickSelection: false,
    }),
    [],
  );
  const selectionChanged = useCallback(
    (event: SelectionChangedEvent<LedgerRow>) => {
      if (
        synchronizingSelection.current ||
        event.source === 'api' ||
        event.source === 'rowDataChanged'
      )
        return;
      const next = new Set(
        event.api
          .getSelectedRows()
          .filter((row) => row.classification === 'change')
          .map((row) => row.id),
      );
      onSelectionChange(
        items
          .filter((item) => item.classification === 'change' && next.has(item.id))
          .map((item) => item.id),
      );
    },
    [items, onSelectionChange],
  );
  const editHours = useCallback(
    (event: CellEditRequestEvent<LedgerRow>) => {
      const value = Number(event.newValue);
      if (event.data?.classification !== 'change' || event.colDef.field !== 'reviewedHours') return;
      if (!Number.isFinite(value) || value < 0.25 || value > 1000) {
        setEditError(
          'Enter an estimate between 0.25 and 1,000 hours. The previous estimate was kept.',
        );
        return;
      }
      setEditError('');
      onHoursChange(event.data.id, value);
    },
    [onHoursChange],
  );
  const columns = useMemo<ColDef<LedgerRow>[]>(
    () => [
      {
        field: 'title',
        headerName: 'Client request',
        minWidth: 205,
        flex: 1.7,
        filter: 'agTextColumnFilter',
        cellRenderer: ({ data }: ICellRendererParams<LedgerRow>) =>
          data && (
            <div className="scope-ledger-request">
              <strong>{data.title}</strong>
              <span>{data.description}</span>
            </div>
          ),
      },
      {
        field: 'classification',
        headerName: 'Scope decision',
        width: 148,
        minWidth: 136,
        valueFormatter: ({ value }) => labels[value as Classification] ?? value,
        cellRenderer: ({ value }: ICellRendererParams<LedgerRow>) => (
          <ClassificationBadge value={value} />
        ),
      },
      {
        field: 'reviewedHours',
        headerName: 'Hours · edit',
        width: 108,
        minWidth: 102,
        cellDataType: 'number',
        filter: 'agNumberColumnFilter',
        editable: ({ data }) => data?.classification === 'change',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0.25, max: 1000, step: 0.25, precision: 2 },
        cellClass: ({ data }) =>
          data?.classification === 'change' ? 'scope-ledger-editable' : 'scope-ledger-nonbillable',
        cellRenderer: ({ data, value }: ICellRendererParams<LedgerRow>) =>
          data?.classification === 'change' ? (
            <span
              className="scope-ledger-hours"
              title="Double-click or press Enter to edit the estimate"
            >
              {value} <span>h</span>
              <SquarePen size={11} aria-hidden="true" />
            </span>
          ) : (
            <span aria-label="Not billable">—</span>
          ),
      },
      {
        field: 'amountCents',
        headerName: 'Addition',
        width: 104,
        minWidth: 92,
        cellDataType: 'number',
        filter: 'agNumberColumnFilter',
        valueFormatter: ({ value }) => money(value ?? 0),
        cellClass: 'scope-ledger-amount',
      },
      {
        colId: 'sources',
        headerName: 'Evidence',
        width: 116,
        minWidth: 108,
        sortable: false,
        valueGetter: ({ data }) => data?.evidence.length ?? 0,
        getQuickFilterText: ({ data }) =>
          data ? [data.reason, ...data.evidence.map((entry) => entry.quote)].join(' ') : '',
        cellRenderer: ({ data }: ICellRendererParams<LedgerRow>) =>
          data && (
            <button
              type="button"
              className={`scope-ledger-evidence-button ${active?.id === data.id ? 'is-active' : ''}`}
              aria-label={`Review ${data.evidence.length} sources for ${data.title}`}
              aria-controls={`${id}-sources`}
              aria-expanded={active?.id === data.id}
              onClick={() => setActiveId(data.id)}
            >
              <BookOpen size={13} aria-hidden="true" />
              {data.evidence.length} sources
            </button>
          ),
      },
    ],
    [active?.id, id],
  );
  const defaultColDef = useMemo<ColDef<LedgerRow>>(
    () => ({ sortable: true, resizable: true, suppressMovable: true }),
    [],
  );
  const filteredOutSelections = Math.max(0, selectedRows.length - visibleSelected);

  return (
    <section className="scope-ledger" aria-labelledby={`${id}-title`}>
      <div className="scope-ledger-heading">
        <div>
          <span className="scope-ledger-eyebrow">Evidence ledger</span>
          <h3 id={`${id}-title`}>Every request, clearly accounted for.</h3>
          <p>Compare the scope, inspect the sources, and choose what belongs in your proposal.</p>
        </div>
        <span className="scope-ledger-verified">
          <ShieldCheck size={14} aria-hidden="true" />
          Source quotes checked
        </span>
      </div>
      <div className="scope-ledger-toolbar">
        <label className="scope-ledger-search">
          <Search size={15} aria-hidden="true" />
          <span className="scope-ledger-sr-only">
            Search requests, reasoning, and source quotes
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search requests or evidence…"
          />
        </label>
        <div className="scope-ledger-filters" aria-label="Filter scope decisions">
          {(['all', 'change', 'included', 'clarification'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={classification === value}
              onClick={() => setClassification(value)}
            >
              {value === 'all' ? 'All' : labels[value]}
              <span>
                {value === 'all'
                  ? items.length
                  : items.filter((item) => item.classification === value).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div
        className="scope-ledger-grid"
        style={{ height: Math.min(466, 50 + Math.max(3, items.length) * 74) }}
      >
        <AgGridProvider modules={modules}>
          <AgGridReact<LedgerRow>
            theme={ledgerTheme}
            rowData={rowData}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            getRowId={({ data }) => data.id}
            rowSelection={selectionOptions}
            selectionColumnDef={{
              width: 44,
              minWidth: 44,
              maxWidth: 44,
              pinned: 'left',
              resizable: false,
            }}
            quickFilterText={query}
            isExternalFilterPresent={() => classification !== 'all'}
            doesExternalFilterPass={(node: IRowNode<LedgerRow>) =>
              classification === 'all' || node.data?.classification === classification
            }
            onGridReady={({ api }) => {
              api.setGridAriaProperty(
                'label',
                'Scope evidence ledger. Only additional work can be selected. Press Enter in an hours cell to edit its estimate.',
              );
              setGridApi(api);
            }}
            onRowDataUpdated={({ api }) => syncSelection(api)}
            onSelectionChanged={selectionChanged}
            onFilterChanged={({ api }) => updateVisibleCounts(api)}
            onCellEditRequest={editHours}
            onCellFocused={({ api, rowIndex }) => {
              if (rowIndex === null) return;
              const item = api.getDisplayedRowAtIndex(rowIndex)?.data;
              if (item) setActiveId(item.id);
            }}
            onCellClicked={({ data, column }) => {
              if (data && !['reviewedHours', 'ag-Grid-SelectionColumn'].includes(column.getColId()))
                setActiveId(data.id);
            }}
            readOnlyEdit
            stopEditingWhenCellsLoseFocus
            rowHeight={74}
            headerHeight={44}
            animateRows={false}
            suppressCellFocus={false}
            tooltipShowDelay={200}
            overlayNoRowsTemplate="<span>No requests match these filters.</span>"
          />
        </AgGridProvider>
      </div>
      <div className="scope-ledger-summary" aria-live="polite">
        <span>
          {visibleCount} of {items.length} requests shown
          {filteredOutSelections > 0
            ? ` · ${filteredOutSelections} selected outside this view`
            : ''}
        </span>
        <strong>
          {selectedRows.length} selected <span>·</span> {money(selectedTotal)}{' '}
          <small>additional work</small>
        </strong>
      </div>
      <p className="scope-ledger-help">
        Only additional work can be selected. Edit hours with a double-click or Enter. Filtering
        keeps your selection.
      </p>
      {editError && (
        <p className="scope-ledger-error" role="alert">
          {editError}
        </p>
      )}
      {active && (
        <div className="scope-ledger-sources" id={`${id}-sources`}>
          <div className="scope-ledger-source-heading">
            <div>
              <span className="scope-ledger-eyebrow">The reasoning & sources</span>
              <h4>{active.title}</h4>
            </div>
            <ClassificationBadge value={active.classification} />
          </div>
          <p className="scope-ledger-reason">{active.reason}</p>
          <div className="scope-ledger-quotes">
            {active.evidence.map((evidence, index) => (
              <blockquote key={`${evidence.sourceId}-${index}`}>
                <div>
                  <BookOpen size={13} aria-hidden="true" />
                  <span>
                    {evidence.sourceType === 'brief' ? 'Original agreement' : 'Client message'}
                  </span>
                </div>
                <p>{evidence.quote}</p>
                {evidence.label && <cite>{evidence.label}</cite>}
              </blockquote>
            ))}
          </div>
          {active.questions.length > 0 && (
            <div className="scope-ledger-questions">
              <strong>Clarify before agreeing</strong>
              <ul>
                {active.questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          )}
          <span className="scope-ledger-source-note">
            {active.confidence} model confidence · Quotations match the source text. Review the
            interpretation before sharing a price.
          </span>
        </div>
      )}
    </section>
  );
}
