export { buildSourceBOM, buildSourceBOMWithBilling, matchHostToClassicBM, groupHostMappings, classifyDatastoreStorage } from './sourceBomService';
export type {
  ClassicBareMetalCpu,
  ClassicBareMetalRam,
  HostMapping,
  HostGroupLineItem,
  StorageLineItem,
  DatastoreStorageTarget,
  SourceBOMInput,
  SourceBOMResult,
  AdditionalBillingCosts,
} from './types';
