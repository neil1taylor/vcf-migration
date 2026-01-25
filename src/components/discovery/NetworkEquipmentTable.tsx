/**
 * NetworkEquipmentTable Component
 *
 * Displays detected network equipment VMs in a Carbon DataTable with:
 * - Clickable type filters
 * - Search functionality
 * - Pagination
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Button,
  Pagination,
  ClickableTile,
} from '@carbon/react';
import { Close, DocumentExport } from '@carbon/icons-react';
import { formatNumber } from '@/utils/formatters';
import './NetworkEquipmentTable.scss';

// ===== TYPES =====

export interface NetworkMatch {
  vmName: string;
  matchedPattern: string;
  source: 'name' | 'annotation';
  guestOS?: string;
  cpus?: number;
  memory?: number;
}

interface NetworkEquipmentTableProps {
  matches: NetworkMatch[];
  networkByType: Record<string, NetworkMatch[]>;
}

interface NetworkRow {
  id: string;
  vmName: string;
  matchedPattern: string;
  guestOS: string;
  cpus: string;
  memoryMiB: string;
  source: string;
}

// ===== COMPONENT =====

export function NetworkEquipmentTable({ matches, networkByType }: NetworkEquipmentTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Transform matches to rows
  const rows = useMemo((): NetworkRow[] => {
    return matches.map((match, idx) => ({
      id: `${match.vmName}-${idx}`,
      vmName: match.vmName,
      matchedPattern: match.matchedPattern,
      guestOS: match.guestOS || 'Unknown',
      cpus: match.cpus ? match.cpus.toString() : '-',
      memoryMiB: match.memory ? formatNumber(match.memory) : '-',
      source: match.source === 'name' ? 'VM Name' : 'Annotation',
    }));
  }, [matches]);

  // Filter by type and search term
  const filteredRows = useMemo(() => {
    let result = rows;

    if (selectedType) {
      result = result.filter(row => row.matchedPattern === selectedType);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        row.vmName.toLowerCase().includes(term) ||
        row.matchedPattern.toLowerCase().includes(term) ||
        row.guestOS.toLowerCase().includes(term)
      );
    }

    return result;
  }, [rows, selectedType, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Type click handler
  const handleTypeClick = useCallback((type: string) => {
    setSelectedType(prev => prev === type ? null : type);
    setPage(1);
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['VM Name', 'Equipment Type', 'Guest OS', 'vCPUs', 'Memory (MiB)', 'Source'];
    const csvRows = filteredRows.map(row => [
      row.vmName,
      row.matchedPattern,
      row.guestOS,
      row.cpus,
      row.memoryMiB,
      row.source,
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network-equipment.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'matchedPattern', header: 'Equipment Type' },
    { key: 'guestOS', header: 'Guest OS' },
    { key: 'cpus', header: 'vCPUs' },
    { key: 'memoryMiB', header: 'Memory (MiB)' },
    { key: 'source', header: 'Source' },
  ];

  // Sort types by count
  const sortedTypes = useMemo(() => {
    return Object.entries(networkByType)
      .sort((a, b) => b[1].length - a[1].length);
  }, [networkByType]);

  return (
    <div className="network-equipment-table">
      {/* Clickable type filters */}
      {sortedTypes.length > 0 && (
        <div className="network-equipment-table__filters">
          <span className="network-equipment-table__filters-label">Filter by type:</span>
          <div className="network-equipment-table__filter-tags">
            {sortedTypes.map(([type, typeMatches]) => (
              <ClickableTile
                key={type}
                className={`network-equipment-table__filter-tile ${selectedType === type ? 'network-equipment-table__filter-tile--selected' : ''}`}
                onClick={() => handleTypeClick(type)}
              >
                <span className="network-equipment-table__filter-name">{type}</span>
                <Tag type={selectedType === type ? 'teal' : 'gray'} size="sm">
                  {typeMatches.length}
                </Tag>
              </ClickableTile>
            ))}
            {selectedType && (
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Close}
                onClick={() => {
                  setSelectedType(null);
                  setPage(1);
                }}
                hasIconOnly
                iconDescription="Clear filter"
              />
            )}
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable rows={paginatedRows} headers={headers} isSortable>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getTableContainerProps,
        }) => (
          <TableContainer {...getTableContainerProps()}>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search network equipment..."
                  onChange={(e) => {
                    const value = typeof e === 'string' ? e : e.target.value;
                    setSearchTerm(value);
                    setPage(1);
                  }}
                  value={searchTerm}
                  persistent
                />
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={DocumentExport}
                  onClick={handleExportCSV}
                  hasIconOnly
                  iconDescription="Export to CSV"
                />
              </TableToolbarContent>
            </TableToolbar>

            <Table {...getTableProps()} size="md">
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const originalRow = paginatedRows.find(r => r.id === row.id);
                  if (!originalRow) return null;

                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell>{originalRow.vmName}</TableCell>
                      <TableCell>
                        <Tag type="teal" size="sm">{originalRow.matchedPattern}</Tag>
                      </TableCell>
                      <TableCell>{originalRow.guestOS}</TableCell>
                      <TableCell>{originalRow.cpus}</TableCell>
                      <TableCell>{originalRow.memoryMiB}</TableCell>
                      <TableCell>{originalRow.source}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="network-equipment-table__empty">
          <p>No network equipment VMs detected</p>
        </div>
      )}

      {/* Pagination */}
      {rows.length > 0 && (
        <div className="network-equipment-table__pagination">
          <div className="network-equipment-table__pagination-info">
            <Tag type="gray" size="sm">
              {formatNumber(filteredRows.length)} devices
            </Tag>
            {(searchTerm || selectedType) && (
              <Tag type="teal" size="sm">
                Filtered from {formatNumber(rows.length)}
              </Tag>
            )}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            pageSizes={[10, 25, 50, 100]}
            totalItems={filteredRows.length}
            onChange={({ page: newPage, pageSize: newPageSize }) => {
              setPage(newPage);
              setPageSize(newPageSize);
            }}
            itemsPerPageText="Items per page:"
          />
        </div>
      )}
    </div>
  );
}

export default NetworkEquipmentTable;
