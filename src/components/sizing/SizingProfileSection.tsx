// Bare metal profile selection section for the Sizing Calculator
import { useMemo } from 'react';
import {
  Column,
  Tile,
  ComboBox,
  Tag,
} from '@carbon/react';
import { ProfilesRefresh } from '@/components/profiles';
import type { BareMetalProfile, ProfileItem } from '@/hooks/useSizingCalculator';
import type { ProfilesSource } from '@/services/profiles/profilesCache';
import type { RoksSolutionType } from '@/services/costEstimation';

interface SizingProfileSectionProps {
  selectedProfile: BareMetalProfile;
  selectedProfileName: string;
  setSelectedProfileName: (name: string) => void;
  hasUserSelectedProfileRef: React.MutableRefObject<boolean>;
  profileItems: ProfileItem[];
  profilesLastUpdated: Date | null;
  profilesSource: ProfilesSource;
  isRefreshingProfiles: boolean;
  refreshProfiles: () => Promise<void>;
  isProfilesApiAvailable: boolean | null;
  profilesError: string | null;
  profileCounts: { vsi: number; bareMetal: number };
  solutionType?: RoksSolutionType;
}

export function SizingProfileSection({
  selectedProfile,
  selectedProfileName,
  setSelectedProfileName,
  hasUserSelectedProfileRef,
  profileItems,
  profilesLastUpdated,
  profilesSource,
  isRefreshingProfiles,
  refreshProfiles,
  isProfilesApiAvailable,
  profilesError,
  profileCounts,
  solutionType,
}: SizingProfileSectionProps) {
  const selectedItem = useMemo(
    () => profileItems.find((item) => item.id === selectedProfileName) || null,
    [profileItems, selectedProfileName]
  );

  return (
    <Column lg={16} md={8} sm={4}>
      <Tile className="sizing-calculator__section">
        <div className="sizing-calculator__section-header">
          <h3 className="sizing-calculator__section-title">
            {solutionType === 'bm-disaggregated' ? 'Compute Pool Profile' : 'Bare Metal Node Profile'}
          </h3>
          <ProfilesRefresh
            lastUpdated={profilesLastUpdated}
            source={profilesSource}
            isRefreshing={isRefreshingProfiles}
            onRefresh={refreshProfiles}
            isApiAvailable={isProfilesApiAvailable}
            error={profilesError}
            profileCounts={profileCounts}
            compact
          />
        </div>
        <ComboBox
          id="profile-selector"
          titleText="Select IBM Cloud Bare Metal Profile"
          placeholder="Type to search profiles..."
          items={profileItems}
          selectedItem={selectedItem}
          itemToString={(item: ProfileItem | null) => item?.text || ''}
          onChange={({ selectedItem: item }: { selectedItem: ProfileItem | null | undefined }) => {
            if (item) {
              hasUserSelectedProfileRef.current = true;
              setSelectedProfileName(item.id);
            }
          }}
          shouldFilterItem={({ item, inputValue }: { item: ProfileItem; inputValue: string | null }) =>
            !inputValue || item.text.toLowerCase().includes(inputValue.toLowerCase())
          }
        />
        <div className="sizing-calculator__profile-details">
          {selectedProfile.isCustom && (
            <Tag type="purple">{selectedProfile.tag || 'Custom'}</Tag>
          )}
          <Tag type={selectedProfile.roksSupported ? 'green' : 'gray'}>
            {selectedProfile.roksSupported ? 'ROKS Supported' : 'VPC Only'}
          </Tag>
          <Tag type="blue">{selectedProfile.physicalCores} Physical Cores</Tag>
          <Tag type="cyan">{selectedProfile.vcpus} Threads (HT)</Tag>
          <Tag type="teal">{selectedProfile.memoryGiB} GiB RAM</Tag>
          {selectedProfile.hasNvme ? (
            <Tag type="purple">{selectedProfile.nvmeDisks}&times; {selectedProfile.nvmeSizeGiB} GiB NVMe</Tag>
          ) : (
            <Tag type="gray">No Local NVMe</Tag>
          )}
        </div>
        {!selectedProfile.roksSupported && (
          <div className="sizing-calculator__warning" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-support-warning)', borderRadius: '4px', fontSize: '0.875rem' }}>
            <strong>Note:</strong> This profile is not supported in ROKS/Kubernetes. It can only be provisioned as a standalone VPC bare metal server.
          </div>
        )}
        {selectedProfile.roksSupported && !selectedProfile.hasNvme && (
          <div className="sizing-calculator__warning" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-support-info)', borderRadius: '4px', fontSize: '0.875rem' }}>
            {solutionType === 'bm-disaggregated' ? (
              <><strong>Note:</strong> Compute pool uses diskless bare metal. ODF storage runs on a separate dedicated NVMe bare metal pool.</>
            ) : solutionType === 'bm-block-odf' ? (
              <><strong>Note:</strong> This profile uses VPC Block Storage to back ODF. No local NVMe disks are required.</>
            ) : solutionType === 'bm-block-csi' ? (
              <><strong>Note:</strong> This profile uses VPC Block Storage via CSI driver. No local NVMe disks or ODF are required.</>
            ) : solutionType === 'bm-nfs-csi' ? (
              <><strong>Note:</strong> This profile uses VPC File Storage (NFS) via dp2 CSI driver for all storage. No local NVMe disks or ODF are required.</>
            ) : (
              <><strong>Note:</strong> This profile has no local NVMe storage. ODF (OpenShift Data Foundation) cannot be deployed on nodes without local storage. You will need to use external file storage.</>
            )}
          </div>
        )}
      </Tile>
    </Column>
  );
}
