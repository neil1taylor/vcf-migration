// Bare metal profile selection section for the Sizing Calculator
import {
  Column,
  Tile,
  Select,
  SelectItem,
  Tag,
} from '@carbon/react';
import { ProfilesRefresh } from '@/components/profiles';
import type { BareMetalProfile, ProfileItem } from '@/hooks/useSizingCalculator';
import type { ProfilesSource } from '@/services/profiles/profilesCache';

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
}: SizingProfileSectionProps) {
  return (
    <Column lg={16} md={8} sm={4}>
      <Tile className="sizing-calculator__section">
        <div className="sizing-calculator__section-header">
          <h3 className="sizing-calculator__section-title">Bare Metal Node Profile</h3>
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
        <Select
          id="profile-selector"
          labelText="Select IBM Cloud Bare Metal Profile"
          value={selectedProfileName}
          onChange={(e) => { hasUserSelectedProfileRef.current = true; setSelectedProfileName(e.target.value); }}
        >
          {profileItems.map((item) => (
            <SelectItem key={item.id} value={item.id} text={item.text} />
          ))}
        </Select>
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
            <strong>Note:</strong> This profile has no local NVMe storage. ODF (OpenShift Data Foundation) cannot be deployed on nodes without local storage. You will need to use external file storage.
          </div>
        )}
      </Tile>
    </Column>
  );
}
