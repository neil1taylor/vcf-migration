// Integration tests for MTV YAML generator
// Tests real output with no mocks — verifies YAML structure and Kubernetes resource kinds

import { describe, it, expect, beforeAll } from 'vitest';
import type { RVToolsData } from '@/types/rvtools';
import type { MTVExportOptions } from '@/types/mtvYaml';
import { MTVYAMLGenerator } from '../yamlGenerator';
import { getRVToolsData } from './fixtures';

let data: RVToolsData;

const defaultOptions: MTVExportOptions = {
  namespace: 'openshift-mtv',
  sourceProviderName: 'vsphere-source',
  destinationProviderName: 'host-cluster',
  networkMapName: 'test-network-map',
  storageMapName: 'test-storage-map',
  defaultStorageClass: 'ocs-storagecluster-ceph-rbd',
  targetNamespace: 'migrated-vms',
};

beforeAll(async () => {
  data = await getRVToolsData();
});

describe('YAML integration — Plan generation', () => {
  it('generates valid YAML for a migration plan', () => {
    const generator = new MTVYAMLGenerator(defaultOptions);
    const yaml = generator.generatePlan('wave-1', data.vInfo);

    expect(yaml).toContain('---');
    expect(yaml).toContain('kind: Plan');
    expect(yaml).toContain('apiVersion: forklift.konveyor.io/v1beta1');
    expect(yaml).toContain('namespace: openshift-mtv');
    expect(yaml).toContain('targetNamespace: migrated-vms');
  });

  it('includes VM references', () => {
    const generator = new MTVYAMLGenerator(defaultOptions);
    const yaml = generator.generatePlan('wave-1', data.vInfo);

    // VMs should be listed
    expect(yaml).toContain('vms:');
    // At least one VM name from the fixture
    for (const vm of data.vInfo) {
      expect(yaml).toContain(vm.vmName);
    }
  });
});

describe('YAML integration — NetworkMap generation', () => {
  it('generates valid YAML for a network map', () => {
    const generator = new MTVYAMLGenerator(defaultOptions);
    const yaml = generator.generateNetworkMap(data.vNetwork);

    expect(yaml).toContain('---');
    expect(yaml).toContain('kind: NetworkMap');
    expect(yaml).toContain('apiVersion: forklift.konveyor.io/v1beta1');
  });

  it('maps unique networks', () => {
    const generator = new MTVYAMLGenerator(defaultOptions);
    const yaml = generator.generateNetworkMap(data.vNetwork);

    // Should have at least one network mapping
    expect(yaml).toContain('map:');
    expect(yaml).toContain('source:');
    expect(yaml).toContain('destination:');
  });
});

describe('YAML integration — StorageMap generation', () => {
  it('generates valid YAML for a storage map', () => {
    const generator = new MTVYAMLGenerator(defaultOptions);
    const yaml = generator.generateStorageMap(data.vDatastore);

    expect(yaml).toContain('---');
    expect(yaml).toContain('kind: StorageMap');
    expect(yaml).toContain('apiVersion: forklift.konveyor.io/v1beta1');
    expect(yaml).toContain('storageClass: ocs-storagecluster-ceph-rbd');
  });
});

describe('YAML integration — Bundle generation', () => {
  it('generates a ZIP bundle with all resources', async () => {
    const generator = new MTVYAMLGenerator(defaultOptions);
    const waves = [
      { name: 'Pilot Wave', vms: data.vInfo.slice(0, 1) },
      { name: 'Wave 2', vms: data.vInfo.slice(1) },
    ];

    const blob = await generator.generateBundle(waves, data.vNetwork, data.vDatastore);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/zip');
  });
});
