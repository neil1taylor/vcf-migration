// Custom hook for accessing data context
import { useContext } from 'react';
import { DataContext } from '@/context/DataContext';

/**
 * Detects VMware/VCF infrastructure VMs that should be excluded from migration.
 * These are infrastructure components that won't migrate to IBM Cloud.
 */
function isVMwareInfrastructureVM(vmName: string, guestOS?: string): boolean {
  const name = vmName.toLowerCase();
  const os = guestOS?.toLowerCase() ?? '';

  // NSX-T edge appliances (T0/T1 gateways)
  if (
    name.includes('cust-edge') ||
    name.includes('service-edge') ||
    name.includes('nsx-edge') ||
    name.includes('edge-node') ||
    // Match patterns like "edge-01", "edge01", "t0-edge", "t1-edge"
    /\bedge[-_]?\d/.test(name) ||
    /t[01][-_]?edge/.test(name)
  ) {
    return true;
  }

  // NSX-T controller/manager VMs
  if (name.includes('nsxt-ctrlmgr') || name.includes('nsx-manager') || name.includes('nsx-controller')) {
    return true;
  }

  // VMware usage meter (license tracking)
  if (name.includes('usage-meter') || name.includes('usagemeter')) {
    return true;
  }

  // vCenter Server Appliance (VCSA)
  // - Names containing vcenter or vcsa
  // - Names ending in -vc with Photon OS (reported as "Other 3.x or later Linux")
  if (
    name.includes('vcenter') ||
    name.includes('vcsa') ||
    (name.endsWith('-vc') && os.includes('other') && os.includes('linux'))
  ) {
    return true;
  }

  return false;
}

export function useData() {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }

  return context;
}

// Hook to check if data is loaded
export function useHasData() {
  const { rawData } = useData();
  return rawData !== null;
}

// Hook to get VM count (excludes VMware infrastructure VMs)
export function useVMCount() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)).length ?? 0;
}

// Hook to get powered on VMs (excludes VMware infrastructure VMs)
export function usePoweredOnVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm =>
    vm.powerState === 'poweredOn' && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)
  ) ?? [];
}

// Hook to get templates
export function useTemplates() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => vm.template) ?? [];
}

// Hook to get non-template VMs (excludes VMware infrastructure VMs)
export function useVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)) ?? [];
}

// Hook to get VMware infrastructure VMs excluded from migration (for reporting purposes)
export function useVMwareInfrastructureVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !vm.template && isVMwareInfrastructureVM(vm.vmName, vm.guestOS)) ?? [];
}

// Legacy alias for backwards compatibility
export const useNSXEdgeAppliances = useVMwareInfrastructureVMs;
