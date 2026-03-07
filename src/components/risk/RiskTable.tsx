import { useState, useMemo } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  Tag,
  Button,
  Dropdown,
  TextArea,
} from '@carbon/react';
import { Add, TrashCan, Reset } from '@carbon/icons-react';
import type { RiskTableData, RiskStatus, RiskRow, RiskCategory } from '@/types/riskAssessment';
import { RISK_CATEGORIES, RISK_STATUS_COLORS } from '@/types/riskAssessment';
import { AddRiskModal } from './AddRiskModal';

interface RiskTableProps {
  riskTable: RiskTableData;
  onUpdateStatus: (rowId: string, status: RiskStatus) => void;
  onUpdateMitigation: (rowId: string, mitigation: string) => void;
  onAddRow: (row: Omit<RiskRow, 'id' | 'source'>) => void;
  onRemoveRow: (rowId: string) => void;
  onClearAll: () => void;
}

const STATUS_OPTIONS: { id: RiskStatus; text: string }[] = [
  { id: 'red', text: 'Red' },
  { id: 'amber', text: 'Amber' },
  { id: 'green', text: 'Green' },
];

const STATUS_INDICATORS: Record<RiskStatus, string> = {
  red: '\u{1F534}',
  amber: '\u{1F7E1}',
  green: '\u{1F7E2}',
};

const SOURCE_TAG_TYPE: Record<string, 'blue' | 'teal' | 'cyan'> = {
  auto: 'blue',
  curated: 'teal',
  user: 'cyan',
};

const CATEGORY_FILTER_OPTIONS = [
  { id: 'all', text: 'All Categories' },
  ...RISK_CATEGORIES.map(c => ({ id: c, text: c })),
];

export function RiskTable({
  riskTable,
  onUpdateStatus,
  onUpdateMitigation,
  onAddRow,
  onRemoveRow,
  onClearAll,
}: RiskTableProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingMitigation, setEditingMitigation] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (categoryFilter === 'all') return riskTable.rows;
    return riskTable.rows.filter(r => r.category === categoryFilter);
  }, [riskTable.rows, categoryFilter]);

  // Summary counts
  const redCount = riskTable.rows.filter(r => r.status === 'red').length;
  const amberCount = riskTable.rows.filter(r => r.status === 'amber').length;
  const greenCount = riskTable.rows.filter(r => r.status === 'green').length;

  const headers = [
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Risk Description' },
    { key: 'impactArea', header: 'Impact Area' },
    { key: 'status', header: 'Status' },
    { key: 'mitigationPlan', header: 'Mitigation Plan' },
    { key: 'evidenceDetail', header: 'Evidence / Detail' },
    { key: 'actions', header: '' },
  ];

  const tableRows = filteredRows.map(row => ({
    id: row.id,
    ...row,
  }));

  return (
    <>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Tag type={redCount > 0 ? 'red' : 'gray'} size="md">
          {STATUS_INDICATORS.red} {redCount} Red
        </Tag>
        <Tag type={amberCount > 0 ? 'warm-gray' : 'gray'} size="md">
          {STATUS_INDICATORS.amber} {amberCount} Amber
        </Tag>
        <Tag type={greenCount > 0 ? 'green' : 'gray'} size="md">
          {STATUS_INDICATORS.green} {greenCount} Green
        </Tag>
      </div>

      <DataTable rows={tableRows} headers={headers} size="md">
        {({ rows, headers: hdrs, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Dropdown
                    id="category-filter"
                    label="Filter"
                    titleText=""
                    size="sm"
                    items={CATEGORY_FILTER_OPTIONS}
                    selectedItem={CATEGORY_FILTER_OPTIONS.find(o => o.id === categoryFilter)}
                    onChange={({ selectedItem }: { selectedItem: { id: string } | null }) => {
                      setCategoryFilter(selectedItem?.id ?? 'all');
                    }}
                    style={{ minWidth: '180px' }}
                  />
                  <Button kind="primary" size="sm" renderIcon={Add} onClick={() => setAddModalOpen(true)}>
                    Add Risk
                  </Button>
                  <Button kind="ghost" size="sm" renderIcon={Reset} onClick={onClearAll}>
                    Reset All
                  </Button>
                </div>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {hdrs.map(header => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => {
                  const riskRow = filteredRows.find(r => r.id === row.id)!;
                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <strong>{riskRow.category}</strong>
                          <Tag type={SOURCE_TAG_TYPE[riskRow.source]} size="sm">
                            {riskRow.source === 'auto' ? 'Auto' : riskRow.source === 'curated' ? 'Default' : 'User'}
                          </Tag>
                        </div>
                      </TableCell>
                      <TableCell style={{ maxWidth: '300px' }}>
                        {riskRow.description}
                      </TableCell>
                      <TableCell>{riskRow.impactArea}</TableCell>
                      <TableCell>
                        <Dropdown
                          id={`status-${row.id}`}
                          label=""
                          titleText=""
                          size="sm"
                          items={STATUS_OPTIONS}
                          selectedItem={STATUS_OPTIONS.find(o => o.id === riskRow.status)}
                          onChange={({ selectedItem }: { selectedItem: { id: RiskStatus } | null }) => {
                            if (selectedItem) onUpdateStatus(row.id, selectedItem.id);
                          }}
                          renderSelectedItem={(item: { id: RiskStatus; text: string }) => (
                            <span>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: RISK_STATUS_COLORS[item.id],
                                  marginRight: '0.5rem',
                                }}
                              />
                              {item.text}
                            </span>
                          )}
                          style={{ minWidth: '110px' }}
                        />
                      </TableCell>
                      <TableCell style={{ maxWidth: '300px' }}>
                        {editingMitigation === row.id ? (
                          <TextArea
                            id={`mitigation-${row.id}`}
                            labelText=""
                            hideLabel
                            value={riskRow.mitigationPlan}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdateMitigation(row.id, e.target.value)}
                            onBlur={() => setEditingMitigation(null)}
                            rows={3}
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => setEditingMitigation(row.id)}
                            style={{ cursor: 'pointer', display: 'block', minHeight: '1.5rem' }}
                            title="Click to edit"
                          >
                            {riskRow.mitigationPlan || <em style={{ color: '#a8a8a8' }}>Click to add...</em>}
                          </span>
                        )}
                      </TableCell>
                      <TableCell style={{ maxWidth: '200px', color: '#525252', fontSize: '0.875rem' }}>
                        {riskRow.evidenceDetail}
                      </TableCell>
                      <TableCell>
                        {riskRow.source === 'user' && (
                          <Button
                            kind="ghost"
                            size="sm"
                            renderIcon={TrashCan}
                            iconDescription="Delete risk"
                            hasIconOnly
                            onClick={() => onRemoveRow(row.id)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <AddRiskModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={onAddRow}
      />
    </>
  );
}
