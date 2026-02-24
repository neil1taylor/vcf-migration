// Side navigation component — grouped with collapsible menus
import { useLocation, useNavigate } from 'react-router-dom';
import {
  SideNav as CarbonSideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SideNavDivider,
} from '@carbon/react';
import {
  Dashboard,
  LogoKubernetes,
  Search,
  Upload,
  Book,
  Help,
  Settings,
  Report,
  Catalog,
} from '@carbon/icons-react';
import { useHasData } from '@/hooks';
import { ROUTES } from '@/utils/constants';

// Route groups for active-state detection
const infrastructureRoutes = [
  ROUTES.compute, ROUTES.storage, ROUTES.network,
  ROUTES.cluster, ROUTES.hosts, ROUTES.resourcePools, ROUTES.tables,
];

const migrationRoutes = [
  ROUTES.roksMigration, ROUTES.vsiMigration, ROUTES.preflightReport,
];

const referenceRoutes = [
  ROUTES.userGuide, ROUTES.info, ROUTES.documentation,
  ROUTES.vsiMigrationMethods, ROUTES.mtvDocumentation, ROUTES.overheadReference,
];

interface SideNavProps {
  isExpanded?: boolean;
}

export function SideNav({ isExpanded = true }: SideNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasData = useHasData();

  const isActive = (path: string) => location.pathname === path;
  const isInGroup = (routes: string[]) => routes.includes(location.pathname);

  const handleNavClick = (e: React.MouseEvent, path: string, requiresData = false) => {
    e.preventDefault();
    if (requiresData && !hasData) return;
    navigate(path);
  };

  const disabledClass = !hasData ? 'sidenav-link--disabled' : '';

  return (
    <CarbonSideNav
      aria-label="Side navigation"
      isRail={!isExpanded}
      expanded={isExpanded}
    >
      <SideNavItems>
        {/* Upload — always available */}
        <SideNavLink
          renderIcon={Upload}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.home)}
          isActive={isActive(ROUTES.home)}
        >
          Upload
        </SideNavLink>

        <SideNavDivider />

        {/* Step 1: Review */}
        <SideNavLink
          renderIcon={Dashboard}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.dashboard, true)}
          isActive={isActive(ROUTES.dashboard)}
          className={disabledClass}
        >
          Dashboard
        </SideNavLink>

        {/* Step 2: Prepare */}
        <SideNavLink
          renderIcon={Search}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.discovery, true)}
          isActive={isActive(ROUTES.discovery)}
          className={disabledClass}
        >
          Discovery
        </SideNavLink>

        {/* Infrastructure Details — collapsible */}
        <SideNavMenu
          renderIcon={Catalog}
          title="Infrastructure Details"
          defaultExpanded={isInGroup(infrastructureRoutes)}
          isActive={isInGroup(infrastructureRoutes)}
          className={disabledClass}
        >
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.compute, true)}
            isActive={isActive(ROUTES.compute)}
          >
            Compute
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.storage, true)}
            isActive={isActive(ROUTES.storage)}
          >
            Storage
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.network, true)}
            isActive={isActive(ROUTES.network)}
          >
            Network
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.cluster, true)}
            isActive={isActive(ROUTES.cluster)}
          >
            Clusters
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.hosts, true)}
            isActive={isActive(ROUTES.hosts)}
          >
            Hosts
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.resourcePools, true)}
            isActive={isActive(ROUTES.resourcePools)}
          >
            Resource Pools
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.tables, true)}
            isActive={isActive(ROUTES.tables)}
          >
            Data Tables
          </SideNavMenuItem>
        </SideNavMenu>

        {/* Step 3: Migrate — collapsible */}
        <SideNavMenu
          renderIcon={LogoKubernetes}
          title="Migration Assessment"
          defaultExpanded={isInGroup(migrationRoutes)}
          isActive={isInGroup(migrationRoutes)}
          className={disabledClass}
        >
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.roksMigration, true)}
            isActive={isActive(ROUTES.roksMigration)}
          >
            ROKS Migration
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.vsiMigration, true)}
            isActive={isActive(ROUTES.vsiMigration)}
          >
            VSI Migration
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.preflightReport, true)}
            isActive={isActive(ROUTES.preflightReport)}
          >
            Pre-Flight Report
          </SideNavMenuItem>
        </SideNavMenu>

        {/* Step 4: Export */}
        <SideNavLink
          renderIcon={Report}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.export, true)}
          isActive={isActive(ROUTES.export)}
          className={disabledClass}
        >
          Export &amp; Reports
        </SideNavLink>

        <SideNavDivider />

        {/* Settings & Reference */}
        <SideNavLink
          renderIcon={Settings}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.settings)}
          isActive={isActive(ROUTES.settings)}
        >
          Settings
        </SideNavLink>

        <SideNavMenu
          renderIcon={Book}
          title="Reference"
          defaultExpanded={isInGroup(referenceRoutes)}
          isActive={isInGroup(referenceRoutes)}
        >
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.userGuide)}
            isActive={isActive(ROUTES.userGuide)}
          >
            User Guide
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.info)}
            isActive={isActive(ROUTES.info)}
          >
            Sizing Guide
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.documentation)}
            isActive={isActive(ROUTES.documentation)}
          >
            Documentation
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.vsiMigrationMethods)}
            isActive={isActive(ROUTES.vsiMigrationMethods)}
          >
            VSI Migration Methods
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.mtvDocumentation)}
            isActive={isActive(ROUTES.mtvDocumentation)}
          >
            MTV Guide
          </SideNavMenuItem>
          <SideNavMenuItem
            href="#"
            onClick={(e: React.MouseEvent) => handleNavClick(e, ROUTES.overheadReference)}
            isActive={isActive(ROUTES.overheadReference)}
          >
            Overhead Reference
          </SideNavMenuItem>
        </SideNavMenu>

        <SideNavLink
          renderIcon={Help}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.about)}
          isActive={isActive(ROUTES.about)}
        >
          About
        </SideNavLink>
      </SideNavItems>
    </CarbonSideNav>
  );
}
