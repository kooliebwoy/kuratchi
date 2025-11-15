/**
 * Kuratchi Cloud Platform Examples
 * 
 * Demonstrates how to use the Platform Client for managing
 * databases, roles, and permissions in the Cloud tier.
 * 
 * Two-Tier Strategy:
 * - Free: Local TypeScript config (lib/config/roles.ts)
 * - Cloud: API-managed roles/permissions (these examples)
 */

import { cloud } from 'kuratchi-sdk';

// ==================== Platform Client Setup ====================

const platform = cloud.createPlatform({
  apiKey: process.env.KURATCHI_API_KEY!
});

// ==================== Permissions Management ====================

async function permissionsExamples() {
  // List all permissions
  const perms = await platform.permissions.list();
  console.log('All permissions:', perms.data);

  // Filter by category
  const contentPerms = await platform.permissions.list({
    category: 'content'
  });
  console.log('Content permissions:', contentPerms.data);

  // Create a new permission
  const createResult = await platform.permissions.create({
    value: 'posts.create',
    label: 'Create Posts',
    description: 'Ability to create new blog posts',
    category: 'content'
  });

  if (createResult.success) {
    console.log('Permission created:', createResult.data);
  }

  // Update permission
  const updateResult = await platform.permissions.update('perm-id', {
    label: 'Create Blog Posts',
    description: 'Updated description'
  });

  // Archive permission (soft delete)
  await platform.permissions.archive('perm-id');

  // Unarchive
  await platform.permissions.unarchive('perm-id');

  // Hard delete
  await platform.permissions.delete('perm-id');
}

// ==================== Roles Management ====================

async function rolesExamples() {
  // List all roles
  const roles = await platform.roles.list();
  console.log('All roles:', roles.data);

  // Filter by organization
  const orgRoles = await platform.roles.list({
    organizationId: 'org-123'
  });

  // Create a role with permissions
  const createResult = await platform.roles.create({
    name: 'editor',
    description: 'Content editor role',
    permissions: [
      { value: 'posts.create', label: 'Create Posts' },
      { value: 'posts.edit', label: 'Edit Posts' },
      { value: 'posts.delete', label: 'Delete Posts' },
      { value: 'media.upload', label: 'Upload Media' }
    ]
  });

  if (createResult.success) {
    console.log('Role created:', createResult.data);
    const roleId = createResult.data!.id;

    // Get role with full details
    const roleDetails = await platform.roles.get(roleId, {
      includePermissions: true,
      includeOrganizations: true
    });

    console.log('Role details:', roleDetails.data);
    console.log('Permissions:', roleDetails.data?.permissionObjects);
    console.log('Organizations:', roleDetails.data?.organizations);
  }

  // Get role by name
  const editorRole = await platform.roles.getByName('editor', {
    includePermissions: true
  });

  // Update role
  await platform.roles.update('role-id', {
    permissions: [
      { value: 'posts.*', label: 'All Post Permissions' },
      { value: 'media.*', label: 'All Media Permissions' }
    ]
  });

  // Archive role
  await platform.roles.archive('role-id');

  // Delete role
  await platform.roles.delete('role-id');
}

// ==================== Permission-Role Associations ====================

async function permissionAssociations() {
  // Attach permission to role
  await platform.roles.attachPermission('role-id', 'perm-id');

  // Detach permission from role
  await platform.roles.detachPermission('role-id', 'perm-id');

  // Get all permissions for a role
  const rolePerms = await platform.roles.getPermissions('role-id');
  console.log('Role permissions:', rolePerms.data);
}

// ==================== Organization-Role Assignments ====================

async function organizationAssignments() {
  // Assign role to organization
  await platform.roles.attachToOrganization('role-id', 'org-123');

  // Remove role from organization
  await platform.roles.detachFromOrganization('role-id', 'org-123');

  // Get all organizations for a role
  const orgs = await platform.roles.getOrganizations('role-id');
  console.log('Organizations:', orgs.data);

  // Get all roles for an organization
  const orgRoles = await platform.roles.listByOrganization('org-123');
  console.log('Organization roles:', orgRoles.data);
}

// ==================== Complete Workflow Example ====================

async function completeWorkflow() {
  console.log('=== Setting up roles & permissions ===\n');

  // 1. Create permission registry
  const permissions = [
    { value: 'posts.create', label: 'Create Posts', category: 'content' },
    { value: 'posts.edit', label: 'Edit Posts', category: 'content' },
    { value: 'posts.delete', label: 'Delete Posts', category: 'content' },
    { value: 'posts.publish', label: 'Publish Posts', category: 'content' },
    { value: 'media.upload', label: 'Upload Media', category: 'media' },
    { value: 'media.delete', label: 'Delete Media', category: 'media' },
    { value: 'users.create', label: 'Create Users', category: 'users' },
    { value: 'users.edit', label: 'Edit Users', category: 'users' },
    { value: 'users.delete', label: 'Delete Users', category: 'users' }
  ];

  const createdPermissions: string[] = [];

  for (const perm of permissions) {
    const result = await platform.permissions.create(perm);
    if (result.success && result.data) {
      createdPermissions.push(result.data.id);
      console.log(`✓ Created permission: ${perm.value}`);
    }
  }

  // 2. Create roles
  const editorRole = await platform.roles.create({
    name: 'editor',
    description: 'Content editor - can create and edit posts',
    permissions: [
      { value: 'posts.create', label: 'Create Posts' },
      { value: 'posts.edit', label: 'Edit Posts' },
      { value: 'media.upload', label: 'Upload Media' }
    ]
  });

  const moderatorRole = await platform.roles.create({
    name: 'moderator',
    description: 'Content moderator - full content control',
    permissions: [
      { value: 'posts.*', label: 'All Post Permissions' },
      { value: 'media.*', label: 'All Media Permissions' }
    ]
  });

  const adminRole = await platform.roles.create({
    name: 'admin',
    description: 'Administrator - full system access',
    permissions: [
      { value: '*', label: 'All Permissions' }
    ]
  });

  console.log('\n✓ Created 3 roles');

  // 3. Attach roles to organizations
  if (editorRole.success && editorRole.data) {
    await platform.roles.attachToOrganization(editorRole.data.id, 'org-123');
    await platform.roles.attachToOrganization(editorRole.data.id, 'org-456');
    console.log('\n✓ Attached editor role to organizations');
  }

  // 4. Verify setup
  const allRoles = await platform.roles.list();
  console.log(`\n✓ Total roles: ${allRoles.data?.length || 0}`);

  const allPerms = await platform.permissions.list();
  console.log(`✓ Total permissions: ${allPerms.data?.length || 0}`);

  // 5. Get detailed role info
  if (editorRole.success && editorRole.data) {
    const roleDetails = await platform.roles.get(editorRole.data.id, {
      includePermissions: true,
      includeOrganizations: true
    });

    console.log('\n=== Editor Role Details ===');
    console.log('Name:', roleDetails.data?.name);
    console.log('Description:', roleDetails.data?.description);
    console.log('Permissions:', roleDetails.data?.permissionObjects?.map(p => p.value));
    console.log('Organizations:', roleDetails.data?.organizations?.map(o => o.name));
  }
}

// ==================== Database Management ====================

async function databaseExamples() {
  // List all databases
  const databases = await platform.databases.list();
  console.log('All databases:', databases.data);

  // Create database
  const createResult = await platform.databases.create({
    name: 'production-db',
    description: 'Production database',
    organizationId: 'org-123'
  });

  if (createResult.success && createResult.data) {
    console.log('Database created:', createResult.data);
    
    // Get analytics
    const analytics = await platform.databases.analytics(createResult.data.id, {
      days: 14
    });
    
    console.log('Database analytics:', analytics.data);
  }
}

// ==================== Run Examples ====================

async function main() {
  try {
    // Run the complete workflow
    await completeWorkflow();

    // Uncomment to run individual examples
    // await permissionsExamples();
    // await rolesExamples();
    // await permissionAssociations();
    // await organizationAssignments();
    // await databaseExamples();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  permissionsExamples,
  rolesExamples,
  permissionAssociations,
  organizationAssignments,
  databaseExamples,
  completeWorkflow
};
