/**
 * DiscoveryCategoryFilterBar Component
 *
 * Renders the clickable category filter tiles for the DiscoveryVMTable.
 * Sorted by VM count, with an "Unclassified" tile when applicable.
 */

import {
  ClickableTile,
  Tag,
  Button,
} from '@carbon/react';
import { Close } from '@carbon/icons-react';

interface DiscoveryCategoryFilterBarProps {
  sortedCategories: Array<[string, { name: string; vms: Set<string> }]>;
  selectedCategory: string | null;
  onCategorySelect: (key: string | null) => void;
  unclassifiedCount: number;
  setPage: (page: number) => void;
}

export function DiscoveryCategoryFilterBar({
  sortedCategories,
  selectedCategory,
  onCategorySelect,
  unclassifiedCount,
  setPage,
}: DiscoveryCategoryFilterBarProps) {
  return (
    <div className="discovery-vm-table__filters">
      <span className="discovery-vm-table__filters-label">Filter by category:</span>
      <div className="discovery-vm-table__filter-tags">
        {sortedCategories.map(([key, data]) => (
          <ClickableTile
            key={key}
            className={`discovery-vm-table__filter-tile ${selectedCategory === key ? 'discovery-vm-table__filter-tile--selected' : ''}`}
            onClick={() => {
              onCategorySelect(selectedCategory === key ? null : key);
              setPage(1);
            }}
          >
            <span className="discovery-vm-table__filter-name">{data.name}</span>
            <Tag type={selectedCategory === key ? 'blue' : 'gray'} size="sm">
              {data.vms.size}
            </Tag>
          </ClickableTile>
        ))}
        {unclassifiedCount > 0 && (
          <ClickableTile
            className={`discovery-vm-table__filter-tile ${selectedCategory === '_unclassified' ? 'discovery-vm-table__filter-tile--selected' : ''}`}
            onClick={() => {
              onCategorySelect(selectedCategory === '_unclassified' ? null : '_unclassified');
              setPage(1);
            }}
          >
            <span className="discovery-vm-table__filter-name">Unclassified</span>
            <Tag type={selectedCategory === '_unclassified' ? 'blue' : 'gray'} size="sm">
              {unclassifiedCount}
            </Tag>
          </ClickableTile>
        )}
        {selectedCategory && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Close}
            onClick={() => {
              onCategorySelect(null);
              setPage(1);
            }}
            hasIconOnly
            iconDescription="Clear filter"
          />
        )}
      </div>
    </div>
  );
}

export default DiscoveryCategoryFilterBar;
