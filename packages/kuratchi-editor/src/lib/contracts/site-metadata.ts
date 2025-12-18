/**
 * Site Metadata Contract
 * 
 * This file defines the contract between the Dashboard and the Editor.
 * The Dashboard is responsible for managing this data externally and injecting it
 * into the Editor via the `siteMetadata` prop.
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. Dashboard manages CRUD operations for all external data
 * 2. Editor receives data via siteMetadata and renders it
 * 3. Sections read from context, not plugins
 * 4. Multi-tenancy: Data can be shared across multiple sites
 * 
 * @version 2.0.0
 */

// =============================================================================
// CATALOG CONTRACT
// =============================================================================

/**
 * OEM/Brand information for vehicle catalogs
 * Managed in: Dashboard > Catalog > OEMs
 */
export interface CatalogOem {
    id: string;
    name: string;
    logo_url?: string;
    website_url?: string;
    description?: string;
}

/**
 * Vehicle information for catalog display
 * Managed in: Dashboard > Catalog > Vehicles
 */
export interface CatalogVehicle {
    id: string;
    oem_id: string;
    oem_name: string;
    model_name: string;
    model_year?: number;
    category: 'atv' | 'utv' | 'dirtbike' | 'pitbike' | 'motorcycle' | 'electric' | 'other';
    msrp?: number;
    currency?: string;
    thumbnail_url?: string;
    description?: string;
    status: 'draft' | 'published' | 'archived';
    specs?: Record<string, string | number>;
    gallery?: Array<{ url: string; alt?: string }>;
}

// =============================================================================
// FORMS CONTRACT
// =============================================================================

export type FormFieldType = 
    | 'text' 
    | 'email' 
    | 'tel' 
    | 'number' 
    | 'textarea' 
    | 'select' 
    | 'checkbox' 
    | 'radio' 
    | 'date' 
    | 'file';

export interface FormFieldOption {
    id: string;
    label: string;
    value: string;
}

export interface FormField {
    id: string;
    type: FormFieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    name: string;
    options?: FormFieldOption[];
    defaultValue?: string;
    helpText?: string;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        errorMessage?: string;
    };
    width?: '25' | '33' | '50' | '66' | '75' | '100';
}

export interface FormSettings {
    formName: string;
    submitButtonText: string;
    successMessage: string;
    errorMessage: string;
    recipients: string[];
    autoResponder: {
        enabled: boolean;
        subject: string;
        message: string;
        replyTo?: string;
    };
    styling: {
        buttonColor?: string;
        buttonTextColor?: string;
        borderRadius?: string;
        spacing?: 'compact' | 'normal' | 'relaxed';
    };
    redirectUrl?: string;
    submitEndpoint?: string;
}

/**
 * Form definition for embedding in sections
 * Managed in: Dashboard > Forms
 */
export interface SiteForm {
    id: string;
    name: string;
    description?: string;
    fields: FormField[];
    settings: FormSettings;
}

// =============================================================================
// BLOG CONTRACT
// =============================================================================

export interface BlogCategory {
    id: string;
    name: string;
    slug: string;
}

export interface BlogTag {
    id: string;
    name: string;
    slug: string;
}

export interface BlogPost {
    id: string;
    pageId: string;
    title: string;
    slug: string;
    excerpt: string;
    author?: string;
    publishedOn?: string;
    coverImage?: {
        url: string;
        alt?: string;
    };
    categories: string[];
    tags: string[];
    featured?: boolean;
}

export interface BlogSettings {
    layout?: 'classic' | 'grid' | 'minimal';
    showAuthor?: boolean;
    heroStyle?: 'cover' | 'split';
    themeId?: string;
    featuredPostId?: string | null;
    indexPageId?: string | null;
    indexSlug?: string;
    postsPerPage?: number;
    sortOrder?: 'newest' | 'oldest' | 'manual';
}

/**
 * Blog data for blog sections
 * Managed in: Dashboard > Blog
 */
export interface SiteBlog {
    categories: BlogCategory[];
    tags: BlogTag[];
    posts: BlogPost[];
    settings: BlogSettings;
}

// =============================================================================
// NAVIGATION CONTRACT
// =============================================================================

export interface NavigationItem {
    id: string;
    label: string;
    url: string;
    target?: '_self' | '_blank';
    icon?: string;
    children?: NavigationItem[];
}

export interface NavigationMenu {
    id: string;
    name: string;
    items: NavigationItem[];
}

/**
 * Navigation menus for header/footer
 * Managed in: Dashboard > Navigation
 * 
 * MULTI-TENANCY: A menu can be assigned to multiple sites
 */
export interface SiteNavigation {
    header: {
        visible: boolean;
        menuId?: string;          // Reference to a shared menu
        items: NavigationItem[];  // Resolved items (injected by dashboard)
        useMobileMenuOnDesktop?: boolean;
    };
    footer: {
        visible: boolean;
        menuId?: string;
        items: NavigationItem[];
    };
}

// =============================================================================
// THEME CONTRACT
// =============================================================================

export interface ThemeSettings {
    maxWidth: 'full' | 'wide' | 'medium' | 'narrow';
    sectionSpacing: 'none' | 'small' | 'medium' | 'large';
    backgroundColor: string;
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
    borderRadius: 'none' | 'small' | 'medium' | 'large';
}

// =============================================================================
// BUSINESS INFO CONTRACT (for multi-tenancy)
// =============================================================================

/**
 * Business/Location information
 * Useful for multi-location dealerships
 * Managed in: Dashboard > Locations
 */
export interface BusinessInfo {
    id: string;
    name: string;
    address: {
        street: string;
        city: string;
        state: string;
        zip: string;
        country: string;
    };
    phone?: string;
    email?: string;
    hours?: Array<{
        day: string;
        open: string;
        close: string;
        closed?: boolean;
    }>;
    socialLinks?: Array<{
        platform: string;
        url: string;
    }>;
    logo?: string;
    mapUrl?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}

// =============================================================================
// FULL SITE METADATA CONTRACT
// =============================================================================

/**
 * Complete site metadata contract
 * 
 * This is what the Dashboard should provide to the Editor via the `siteMetadata` prop.
 * All data is managed externally in the Dashboard and injected into the Editor.
 * 
 * USAGE:
 * ```tsx
 * <Editor
 *   siteMetadata={{
 *     themeId: 'powersports',
 *     themeSettings: { ... },
 *     forms: [...],
 *     catalogOems: [...],
 *     catalogVehicles: [...],
 *     blog: { ... },
 *     navigation: { ... },
 *     business: { ... }
 *   }}
 * />
 * ```
 */
export interface SiteMetadataContract {
    // Theme
    themeId?: string;
    themeSettings?: ThemeSettings;
    backgroundColor?: string;

    // Forms (managed in Dashboard > Forms)
    forms?: SiteForm[];

    // Catalog (managed in Dashboard > Catalog)
    catalogOems?: CatalogOem[];
    catalogVehicles?: CatalogVehicle[];

    // Blog (managed in Dashboard > Blog)
    blog?: SiteBlog;

    // Navigation (managed in Dashboard > Navigation)
    // Can reference shared menus via menuId for multi-tenancy
    navigation?: SiteNavigation;

    // Business Info (managed in Dashboard > Locations)
    // For multi-location dealerships
    business?: BusinessInfo;

    // Custom data (extensible)
    [key: string]: unknown;
}

// =============================================================================
// CONTEXT TYPE FOR SECTIONS
// =============================================================================

/**
 * Type for the siteMetadata context that sections receive
 * Sections should use: const metadata = getContext<SiteMetadataContext>('siteMetadata')
 */
export interface SiteMetadataContext {
    readonly forms: SiteForm[];
    readonly themeId?: string;
    readonly backgroundColor?: string;
    readonly blog?: SiteBlog;
    readonly catalogOems: CatalogOem[];
    readonly catalogVehicles: CatalogVehicle[];
    readonly navigation?: SiteNavigation;
    readonly business?: BusinessInfo;
}

// =============================================================================
// MULTI-TENANCY HELPERS
// =============================================================================

/**
 * Shared resource reference for multi-tenancy
 * Instead of duplicating data, sites can reference shared resources
 */
export interface SharedResourceRef {
    type: 'menu' | 'form' | 'catalog' | 'business';
    id: string;
    organizationId: string;
}

/**
 * Site configuration with shared resource references
 * Dashboard resolves these references before injecting into Editor
 */
export interface SiteConfig {
    id: string;
    name: string;
    domain: string;
    
    // References to shared resources (resolved by dashboard)
    sharedMenuIds?: string[];
    sharedFormIds?: string[];
    sharedCatalogId?: string;
    businessInfoId?: string;
    
    // Site-specific overrides
    overrides?: {
        themeSettings?: Partial<ThemeSettings>;
        navigation?: Partial<SiteNavigation>;
    };
}

// =============================================================================
// MIGRATION NOTES
// =============================================================================

/**
 * MIGRATION FROM PLUGIN-BASED TO CONTRACT-BASED ARCHITECTURE
 * 
 * BEFORE (Plugin-based):
 * - CatalogPluginSidebar reads from ctx.siteMetadata.catalogVehicles
 * - FormsPluginSidebar reads from ctx.siteMetadata.forms
 * - BlogPluginSidebar reads from ctx.siteMetadata.blog
 * - Plugins provide UI to browse data and insert sections
 * 
 * AFTER (Contract-based):
 * - Dashboard manages all CRUD operations
 * - Dashboard injects resolved data into Editor via siteMetadata
 * - Sections read directly from getContext('siteMetadata')
 * - No intermediate plugins needed
 * 
 * SECTIONS THAT READ FROM CONTEXT:
 * - CatalogView, CatalogGrid, FeaturedVehicles (catalog data)
 * - ContactCTA, FormSection (forms data)
 * - BlogPostList, BlogHero (blog data)
 * - Headers/Footers (navigation data)
 * 
 * PLUGINS TO REMOVE:
 * - catalogPlugin (src/lib/plugins/catalog)
 * - formsPlugin (src/lib/plugins/forms)
 * - blogPlugin (src/lib/plugins/blog)
 * 
 * PLUGINS TO KEEP (for now):
 * - themesPlugin - visual settings (could eventually move to dashboard)
 * - sitePlugin - header/footer selection
 * - pagesPlugin - page management
 * - navigationPlugin - will be migrated to dashboard CRUD
 * - modalsPlugin - modal management (may stay in editor)
 */
