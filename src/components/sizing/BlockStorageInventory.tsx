// VPC Block Storage volume inventory for BM + Block Storage (CSI) solution
import { Tile, Tag } from '@carbon/react';
import { formatNumber, formatBytes } from '@/utils/formatters';
import type { VDiskInfo } from '@/types/rvtools';

interface BlockStorageInventoryProps {
  disks: VDiskInfo[];
  vmCount: number;
}

interface SizeBucket {
  label: string;
  count: number;
  totalGiB: number;
}

export function BlockStorageInventory({
  disks,
  vmCount,
}: BlockStorageInventoryProps) {
  const totalCapacityGiB = disks.reduce((sum, d) => sum + d.capacityMiB / 1024, 0);
  const totalVolumes = disks.length;

  // Average disks per VM
  const avgDisksPerVM = vmCount > 0 ? (totalVolumes / vmCount).toFixed(1) : '0';

  // Size distribution buckets
  const buckets: SizeBucket[] = [
    { label: '< 100 GiB', count: 0, totalGiB: 0 },
    { label: '100–500 GiB', count: 0, totalGiB: 0 },
    { label: '500 GiB–1 TiB', count: 0, totalGiB: 0 },
    { label: '> 1 TiB', count: 0, totalGiB: 0 },
  ];

  for (const disk of disks) {
    const gib = disk.capacityMiB / 1024;
    if (gib < 100) { buckets[0].count++; buckets[0].totalGiB += gib; }
    else if (gib < 500) { buckets[1].count++; buckets[1].totalGiB += gib; }
    else if (gib < 1024) { buckets[2].count++; buckets[2].totalGiB += gib; }
    else { buckets[3].count++; buckets[3].totalGiB += gib; }
  }

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>VPC Block Storage Volumes (CSI)</h4>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <Tile style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>Total Volumes</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{formatNumber(totalVolumes)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>from {formatNumber(vmCount)} VMs ({avgDisksPerVM} disks/VM)</div>
        </Tile>
        <Tile style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>Total Capacity</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{formatBytes(totalCapacityGiB * 1024 * 1024 * 1024)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>1:1 VM disk to block volume</div>
        </Tile>
        <Tile style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>No Replication Overhead</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>1:1</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>VPC Block Storage handles durability</div>
        </Tile>
      </div>

      {/* Size distribution */}
      <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Volume Size Distribution</div>
      <div style={{ display: 'grid', gap: '0.375rem' }}>
        {buckets.map((bucket) => (
          <div key={bucket.label} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--cds-text-secondary)' }}>{bucket.label}</span>
            <div style={{ position: 'relative', height: '16px', backgroundColor: 'var(--cds-layer-02)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${(bucket.count / maxCount) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--cds-interactive)',
                borderRadius: '2px',
                minWidth: bucket.count > 0 ? '4px' : '0',
              }} />
            </div>
            <span style={{ textAlign: 'right' }}>
              {formatNumber(bucket.count)} vol ({totalVolumes > 0 ? Math.round(bucket.count / totalVolumes * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--cds-text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Tag type="teal" size="sm">CSI</Tag>
        Each VM disk becomes a VPC Block Storage volume. Volumes can be expanded online via PVC resize — no downtime required.
      </div>
    </div>
  );
}
