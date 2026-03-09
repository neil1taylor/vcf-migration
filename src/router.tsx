// Application router configuration with lazy loading for code splitting
/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { ROUTES } from '@/utils/constants';
import { Loading } from '@carbon/react';

// Detects chunk load failures (stale deploys, missing hashed assets)
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    (msg.includes('failed to fetch') && error.name === 'TypeError')
  );
}

// Wraps React.lazy() to auto-reload once on chunk load failure
function lazyWithRetry(importFn: () => Promise<{ default: ComponentType<unknown> }>) {
  return lazy(() =>
    importFn().catch((error: unknown) => {
      if (isChunkLoadError(error) && !sessionStorage.getItem('chunk-failed')) {
        sessionStorage.setItem('chunk-failed', '1');
        window.location.reload();
        return { default: (() => null) as unknown as ComponentType<unknown> };
      }
      sessionStorage.removeItem('chunk-failed');
      throw error;
    })
  );
}

// Eagerly load landing page for immediate render
import { LandingPage } from '@/pages/LandingPage';

// Lazy load all other pages for code splitting (with retry on stale chunks)
const DashboardPage = lazyWithRetry(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage as ComponentType<unknown> })));
const ComputePage = lazyWithRetry(() => import('@/pages/ComputePage').then(m => ({ default: m.ComputePage as ComponentType<unknown> })));
const StoragePage = lazyWithRetry(() => import('@/pages/StoragePage').then(m => ({ default: m.StoragePage as ComponentType<unknown> })));
const NetworkPage = lazyWithRetry(() => import('@/pages/NetworkPage').then(m => ({ default: m.NetworkPage as ComponentType<unknown> })));
const ClusterPage = lazyWithRetry(() => import('@/pages/ClusterPage').then(m => ({ default: m.ClusterPage as ComponentType<unknown> })));
const HostsPage = lazyWithRetry(() => import('@/pages/HostsPage').then(m => ({ default: m.HostsPage as ComponentType<unknown> })));
const ResourcePoolPage = lazyWithRetry(() => import('@/pages/ResourcePoolPage').then(m => ({ default: m.ResourcePoolPage as ComponentType<unknown> })));
const ROKSMigrationPage = lazyWithRetry(() => import('@/pages/ROKSMigrationPage').then(m => ({ default: m.ROKSMigrationPage as ComponentType<unknown> })));
const VSIMigrationPage = lazyWithRetry(() => import('@/pages/VSIMigrationPage').then(m => ({ default: m.VSIMigrationPage as ComponentType<unknown> })));
const MigrationComparisonPage = lazyWithRetry(() => import('@/pages/MigrationComparisonPage').then(m => ({ default: m.MigrationComparisonPage as ComponentType<unknown> })));
const PreFlightReportPage = lazyWithRetry(() => import('@/pages/PreFlightReportPage').then(m => ({ default: m.PreFlightReportPage as ComponentType<unknown> })));
const DiscoveryPage = lazyWithRetry(() => import('@/pages/DiscoveryPage').then(m => ({ default: m.DiscoveryPage as ComponentType<unknown> })));
const TablesPage = lazyWithRetry(() => import('@/pages/TablesPage').then(m => ({ default: m.TablesPage as ComponentType<unknown> })));
const InfoPage = lazyWithRetry(() => import('@/pages/InfoPage').then(m => ({ default: m.InfoPage as ComponentType<unknown> })));
const DocumentationPage = lazyWithRetry(() => import('@/pages/DocumentationPage').then(m => ({ default: m.DocumentationPage as ComponentType<unknown> })));
const UserGuidePage = lazyWithRetry(() => import('@/pages/UserGuidePage').then(m => ({ default: m.UserGuidePage as ComponentType<unknown> })));
const VSIMigrationMethodsPage = lazyWithRetry(() => import('@/pages/VSIMigrationMethodsPage').then(m => ({ default: m.VSIMigrationMethodsPage as ComponentType<unknown> })));
const MTVDocumentationPage = lazyWithRetry(() => import('@/pages/MTVDocumentationPage').then(m => ({ default: m.MTVDocumentationPage as ComponentType<unknown> })));
const AboutPage = lazyWithRetry(() => import('@/pages/AboutPage').then(m => ({ default: m.AboutPage as ComponentType<unknown> })));
const OverheadReferencePage = lazyWithRetry(() => import('@/pages/OverheadReferencePage').then(m => ({ default: m.OverheadReferencePage as ComponentType<unknown> })));
const TutorialPage = lazyWithRetry(() => import('@/pages/TutorialPage').then(m => ({ default: m.TutorialPage as ComponentType<unknown> })));
const ChatPage = lazyWithRetry(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage as ComponentType<unknown> })));
const ExportPage = lazyWithRetry(() => import('@/pages/ExportPage').then(m => ({ default: m.ExportPage as ComponentType<unknown> })));
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage as ComponentType<unknown> })));

// Suspense wrapper for lazy-loaded pages
export function PageLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading description="Loading page..." withOverlay={false} />}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: ROUTES.dashboard.slice(1), // Remove leading slash
        element: <PageLoader><DashboardPage /></PageLoader>,
      },
      {
        path: ROUTES.compute.slice(1),
        element: <PageLoader><ComputePage /></PageLoader>,
      },
      {
        path: ROUTES.storage.slice(1),
        element: <PageLoader><StoragePage /></PageLoader>,
      },
      {
        path: ROUTES.network.slice(1),
        element: <PageLoader><NetworkPage /></PageLoader>,
      },
      {
        path: ROUTES.cluster.slice(1),
        element: <PageLoader><ClusterPage /></PageLoader>,
      },
      {
        path: ROUTES.hosts.slice(1),
        element: <PageLoader><HostsPage /></PageLoader>,
      },
      {
        path: ROUTES.resourcePools.slice(1),
        element: <PageLoader><ResourcePoolPage /></PageLoader>,
      },
      {
        path: ROUTES.roksMigration.slice(1),
        element: <PageLoader><ROKSMigrationPage /></PageLoader>,
      },
      {
        path: ROUTES.vsiMigration.slice(1),
        element: <PageLoader><VSIMigrationPage /></PageLoader>,
      },
      {
        path: ROUTES.migrationComparison.slice(1),
        element: <PageLoader><MigrationComparisonPage /></PageLoader>,
      },
      {
        path: ROUTES.preflightReport.slice(1),
        element: <PageLoader><PreFlightReportPage /></PageLoader>,
      },
      {
        path: ROUTES.discovery.slice(1),
        element: <PageLoader><DiscoveryPage /></PageLoader>,
      },
      {
        path: 'risk-assessment',
        element: <Navigate to={ROUTES.migrationComparison} replace />,
      },
      {
        path: 'migration-timeline',
        element: <Navigate to={ROUTES.migrationComparison} replace />,
      },
      {
        path: ROUTES.networkDesign.slice(1),
        element: <Navigate to={ROUTES.vsiMigration} replace />,
      },
      {
        path: ROUTES.tables.slice(1),
        element: <PageLoader><TablesPage /></PageLoader>,
      },
      {
        path: ROUTES.info.slice(1),
        element: <PageLoader><InfoPage /></PageLoader>,
      },
      {
        path: ROUTES.documentation.slice(1),
        element: <PageLoader><DocumentationPage /></PageLoader>,
      },
      {
        path: ROUTES.userGuide.slice(1),
        element: <PageLoader><UserGuidePage /></PageLoader>,
      },
      {
        path: ROUTES.vsiMigrationMethods.slice(1),
        element: <PageLoader><VSIMigrationMethodsPage /></PageLoader>,
      },
      {
        path: ROUTES.mtvDocumentation.slice(1),
        element: <PageLoader><MTVDocumentationPage /></PageLoader>,
      },
      {
        path: ROUTES.about.slice(1),
        element: <PageLoader><AboutPage /></PageLoader>,
      },
      {
        path: ROUTES.overheadReference.slice(1),
        element: <PageLoader><OverheadReferencePage /></PageLoader>,
      },
      {
        path: ROUTES.export.slice(1),
        element: <PageLoader><ExportPage /></PageLoader>,
      },
      {
        path: ROUTES.settings.slice(1),
        element: <PageLoader><SettingsPage /></PageLoader>,
      },
      {
        path: ROUTES.tutorial.slice(1),
        element: <PageLoader><TutorialPage /></PageLoader>,
      },
      {
        path: ROUTES.chat.slice(1),
        element: <PageLoader><ChatPage /></PageLoader>,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
