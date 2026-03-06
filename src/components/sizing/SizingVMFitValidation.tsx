import {
  Column,
  Tile,
  Tag,
} from '@carbon/react';
import type { VMFitValidation } from '@/hooks/useSizingCalculator';

interface SizingVMFitValidationProps {
  vmFitValidation: VMFitValidation;
}

export function SizingVMFitValidation({ vmFitValidation }: SizingVMFitValidationProps) {
  return (
    <Column lg={16} md={8} sm={4}>
      <Tile className={`sizing-calculator__validation-results ${vmFitValidation.allFit ? 'sizing-calculator__validation-results--pass' : 'sizing-calculator__validation-results--fail'}`}>
        <div className="sizing-calculator__validation-header">
          <h3 className="sizing-calculator__section-title">Per-VM Node Fit Check</h3>
          <Tag type={vmFitValidation.allFit ? 'green' : 'red'} size="md">
            {vmFitValidation.allFit ? 'PASSED' : 'FAILED'}
          </Tag>
        </div>
        <p className="sizing-calculator__subtitle">
          Verifying every individual VM (with virtualization overhead) can fit within a single node&apos;s available capacity
        </p>

        {vmFitValidation.allFit ? (
          <p style={{ marginTop: '0.5rem', color: 'var(--cds-text-secondary)' }}>
            All VMs fit within a single node&apos;s capacity.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--cds-border-subtle-01, #e0e0e0)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>VM Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Resource</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>VM Requirement</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Node Capacity</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Exceeds By</th>
                  </tr>
                </thead>
                <tbody>
                  {vmFitValidation.oversizedVMs.map((vm) => (
                    <tr key={vm.vmName} style={{ borderBottom: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{vm.vmName}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <Tag type="red" size="sm">
                          {vm.resource === 'both' ? 'Memory + CPU' : vm.resource === 'memory' ? 'Memory' : 'CPU'}
                        </Tag>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {(vm.resource === 'memory' || vm.resource === 'both') && (
                          <span>{vm.vmMemoryGiB} GiB RAM</span>
                        )}
                        {vm.resource === 'both' && <span> / </span>}
                        {(vm.resource === 'cpu' || vm.resource === 'both') && (
                          <span>{vm.vmCPUs} vCPUs</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {(vm.resource === 'memory' || vm.resource === 'both') && (
                          <span>{vm.nodeMemoryCapacity} GiB</span>
                        )}
                        {vm.resource === 'both' && <span> / </span>}
                        {(vm.resource === 'cpu' || vm.resource === 'both') && (
                          <span>{vm.nodeCPUCapacity} vCPUs</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--cds-support-error)' }}>
                        {(vm.resource === 'memory' || vm.resource === 'both') && vm.nodeMemoryCapacity > 0 && (
                          <span>+{Math.round(((vm.vmMemoryGiB / vm.nodeMemoryCapacity) - 1) * 100)}% mem</span>
                        )}
                        {vm.resource === 'both' && <span>, </span>}
                        {(vm.resource === 'cpu' || vm.resource === 'both') && vm.nodeCPUCapacity > 0 && (
                          <span>+{Math.round(((vm.vmCPUs / vm.nodeCPUCapacity) - 1) * 100)}% cpu</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-support-error)', color: 'white', borderRadius: '4px' }}>
              <strong>Action required:</strong> {vmFitValidation.oversizedVMs.length} VM{vmFitValidation.oversizedVMs.length !== 1 ? 's' : ''} cannot
              fit on a single node. Select a larger bare metal profile, exclude these VMs, or right-size them in the Discovery page.
            </div>
          </>
        )}
      </Tile>
    </Column>
  );
}
