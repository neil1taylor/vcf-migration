import { describe, it, expect } from 'vitest';
import {
  getVMWorkloadCategory,
  getStorageTierForWorkload,
  getCategoryDisplayName,
  getStorageTierLabel,
  getNfsIopsForTier,
} from './workloadClassification';

describe('workloadClassification', () => {
  describe('getVMWorkloadCategory', () => {
    it('should detect database VMs', () => {
      expect(getVMWorkloadCategory('prod-oracle-db01')).toBe('databases');
      expect(getVMWorkloadCategory('mysql-primary')).toBe('databases');
      expect(getVMWorkloadCategory('postgres-replica-02')).toBe('databases');
    });

    it('should detect middleware VMs', () => {
      expect(getVMWorkloadCategory('tomcat-app-server')).toBe('middleware');
      expect(getVMWorkloadCategory('nginx-proxy-01')).toBe('middleware');
    });

    it('should detect enterprise VMs', () => {
      expect(getVMWorkloadCategory('sap-hana-prod')).toBe('enterprise');
      expect(getVMWorkloadCategory('sharepoint-web01')).toBe('enterprise');
    });

    it('should detect backup VMs', () => {
      expect(getVMWorkloadCategory('veeam-backup-01')).toBe('backup');
      expect(getVMWorkloadCategory('commvault-media')).toBe('backup');
    });

    it('should detect monitoring VMs', () => {
      expect(getVMWorkloadCategory('grafana-monitor')).toBe('monitoring');
      expect(getVMWorkloadCategory('prometheus-server')).toBe('monitoring');
    });

    it('should return null for unclassified VMs', () => {
      expect(getVMWorkloadCategory('random-vm-xyz')).toBeNull();
      expect(getVMWorkloadCategory('webserver-123')).toBeNull();
    });

    it('should match from annotation when name does not match', () => {
      expect(getVMWorkloadCategory('custom-app-01', 'running oracle database')).toBe('databases');
    });

    it('should be case-insensitive', () => {
      expect(getVMWorkloadCategory('PROD-ORACLE-DB01')).toBe('databases');
    });
  });

  describe('getStorageTierForWorkload', () => {
    it('should return 10iops for databases', () => {
      expect(getStorageTierForWorkload('databases')).toBe('10iops');
    });

    it('should return 10iops for enterprise', () => {
      expect(getStorageTierForWorkload('enterprise')).toBe('10iops');
    });

    it('should return 10iops for storage', () => {
      expect(getStorageTierForWorkload('storage')).toBe('10iops');
    });

    it('should return 5iops for messaging', () => {
      expect(getStorageTierForWorkload('messaging')).toBe('5iops');
    });

    it('should return 5iops for middleware', () => {
      expect(getStorageTierForWorkload('middleware')).toBe('5iops');
    });

    it('should return 5iops for monitoring', () => {
      expect(getStorageTierForWorkload('monitoring')).toBe('5iops');
    });

    it('should return 5iops for containers', () => {
      expect(getStorageTierForWorkload('containers')).toBe('5iops');
    });

    it('should return 5iops for devops', () => {
      expect(getStorageTierForWorkload('devops')).toBe('5iops');
    });

    it('should return general-purpose for backup', () => {
      expect(getStorageTierForWorkload('backup')).toBe('general-purpose');
    });

    it('should return general-purpose for security', () => {
      expect(getStorageTierForWorkload('security')).toBe('general-purpose');
    });

    it('should return general-purpose for network', () => {
      expect(getStorageTierForWorkload('network')).toBe('general-purpose');
    });

    it('should return general-purpose for null (unclassified)', () => {
      expect(getStorageTierForWorkload(null)).toBe('general-purpose');
    });

    it('should return general-purpose for unknown categories', () => {
      expect(getStorageTierForWorkload('nonexistent')).toBe('general-purpose');
    });
  });

  describe('getCategoryDisplayName', () => {
    it('should return display name for known category', () => {
      expect(getCategoryDisplayName('databases')).toBe('Databases');
      expect(getCategoryDisplayName('middleware')).toBe('Middleware / Application Servers');
    });

    it('should return null for null input', () => {
      expect(getCategoryDisplayName(null)).toBeNull();
    });

    it('should return null for unknown category', () => {
      expect(getCategoryDisplayName('nonexistent')).toBeNull();
    });
  });

  describe('getStorageTierLabel', () => {
    it('should return short tier names', () => {
      expect(getStorageTierLabel('general-purpose')).toBe('Standard');
      expect(getStorageTierLabel('5iops')).toBe('Performance');
      expect(getStorageTierLabel('10iops')).toBe('High Performance');
    });
  });

  describe('getNfsIopsForTier', () => {
    it('should map storage tiers to NFS dp2 IOPS values', () => {
      expect(getNfsIopsForTier('general-purpose')).toBe(500);
      expect(getNfsIopsForTier('5iops')).toBe(1000);
      expect(getNfsIopsForTier('10iops')).toBe(3000);
    });
  });
});
