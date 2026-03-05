// Inline storage tier selector for the VSI sizing table
// Shows current tier as a color-coded tag with dropdown to override

import { useState } from 'react';
import { Tag, Button, Tooltip } from '@carbon/react';
import { Reset, Edit, Checkmark } from '@carbon/icons-react';
import type { StorageTierType } from '@/utils/workloadClassification';
import { getStorageTierLabel, getCategoryDisplayName } from '@/utils/workloadClassification';

interface StorageTierSelectorProps {
  vmName: string;
  currentTier: StorageTierType;
  autoTier: StorageTierType;
  isOverridden: boolean;
  workloadCategory: string | null;
  onTierChange: (vmName: string, tier: StorageTierType) => void;
  onResetToAuto: (vmName: string) => void;
}

const TIER_OPTIONS: { value: StorageTierType; label: string }[] = [
  { value: 'general-purpose', label: '3 IOPS/GB (General Purpose)' },
  { value: '5iops', label: '5 IOPS/GB' },
  { value: '10iops', label: '10 IOPS/GB' },
];

const TIER_TAG_TYPE: Record<StorageTierType, 'gray' | 'teal' | 'purple'> = {
  'general-purpose': 'gray',
  '5iops': 'teal',
  '10iops': 'purple',
};

export function StorageTierSelector({
  vmName,
  currentTier,
  autoTier,
  isOverridden,
  workloadCategory,
  onTierChange,
  onResetToAuto,
}: StorageTierSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);

  const categoryName = getCategoryDisplayName(workloadCategory);
  const tooltipText = categoryName
    ? `${categoryName} \u2192 ${getStorageTierLabel(autoTier)}`
    : `Default \u2192 ${getStorageTierLabel(autoTier)}`;

  if (!isEditing) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        <Tooltip label={tooltipText} align="top">
          <button type="button" className="tooltip-trigger">
            <Tag type={TIER_TAG_TYPE[currentTier]} size="sm">
              {getStorageTierLabel(currentTier)}
            </Tag>
          </button>
        </Tooltip>
        {isOverridden && (
          <Tag type="blue" size="sm">Override</Tag>
        )}
        <Tooltip label="Change storage tier" align="top">
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Edit storage tier"
            renderIcon={Edit}
            onClick={() => setIsEditing(true)}
            style={{ minHeight: 'auto', padding: '2px' }}
          />
        </Tooltip>
        {isOverridden && (
          <Tooltip label={`Reset to auto (${getStorageTierLabel(autoTier)})`} align="top">
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              iconDescription="Reset to auto"
              renderIcon={Reset}
              onClick={() => onResetToAuto(vmName)}
              style={{ minHeight: 'auto', padding: '2px' }}
            />
          </Tooltip>
        )}
      </span>
    );
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <select
        value={currentTier}
        onChange={(e) => {
          const newTier = e.target.value as StorageTierType;
          if (newTier !== autoTier) {
            onTierChange(vmName, newTier);
          } else {
            onResetToAuto(vmName);
          }
          setIsEditing(false);
        }}
        style={{ fontSize: '0.75rem', padding: '2px 4px' }}
      >
        {TIER_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <Button
        kind="ghost"
        size="sm"
        hasIconOnly
        iconDescription="Done"
        renderIcon={Checkmark}
        onClick={() => setIsEditing(false)}
        style={{ minHeight: 'auto', padding: '2px' }}
      />
    </span>
  );
}

export default StorageTierSelector;
