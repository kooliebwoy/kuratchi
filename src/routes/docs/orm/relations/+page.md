---
layout: docs
---

# Relations

Eager-load related data using `.include()` with automatic foreign key detection.

## How It Works

The ORM automatically detects relationships by:
1. **Many-to-One (Parent)**: Looks for `<table>Id` or `<singular>Id` column on the main table
2. **One-to-Many (Children)**: Looks for `<singular(mainTable)>Id` column on the related table

## One-to-Many (Children)

Load a parent record with its children:

```typescript
// Schema
const schema: DatabaseSchema = {
  name: 'blog',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'integer', primaryKey: true },
        { name: 'name', type: 'text' }
      ]
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'integer', primaryKey: true },
        { name: 'userId', type: 'integer', references: { table: 'users', column: 'id' } },
        { name: 'title', type: 'text' }
      ]
    }
  ]
};

// Query: Load user with their posts
const result = await db.users
  .where({ id: 1 })
  .include({ posts: true })
  .one();

if (result.success) {
  const user = result.data;
  console.log(user.name);
  console.log(user.posts); // Array of post objects
}
```

## Many-to-One (Parent)

Load a child record with its parent:

```typescript
// Query: Load post with its author
const result = await db.posts
  .where({ id: 1 })
  .include({ user: true })
  .one();

if (result.success) {
  const post = result.data;
  console.log(post.title);
  console.log(post.user); // User object
}
```

## Include Configuration

### Basic Include

```typescript
.include({ posts: true })
```

### Custom Alias

```typescript
.include({
  posts: {
    as: 'articles'  // Access via result.data.articles
  }
})
```

### Custom Keys

```typescript
.include({
  posts: {
    localKey: 'id',        // Column on main table (default: 'id')
    foreignKey: 'authorId', // Column on related table (default: '<singular>Id')
    table: 'posts'         // Related table name (default: key name)
  }
})
```

## Multiple Includes

Load multiple relations at once:

```typescript
const result = await db.users
  .where({ id: 1 })
  .include({
    posts: true,
    comments: true,
    profile: true
  })
  .one();

if (result.success) {
  const user = result.data;
  console.log(user.posts);    // Array
  console.log(user.comments); // Array
  console.log(user.profile);  // Object (if many-to-one)
}
```

## Foreign Key Detection

The ORM automatically detects foreign keys by checking for:

### Parent (Many-to-One)
Checks if main table has columns named:
- `<singularTable>Id` (e.g., `userId` for `users` table)
- `<table>Id` (e.g., `usersId`)

### Children (One-to-Many)
Checks if related table has column named:
- `<singular(mainTable)>Id` (e.g., `userId` when main table is `users`)

## Examples

### Blog with Comments

```typescript
const result = await db.posts
  .where({ published: true })
  .include({ user: true, comments: true })
  .orderBy('createdAt', 'desc')
  .limit(10)
  .many();

if (result.success) {
  result.data.forEach(post => {
    console.log(`${post.title} by ${post.user.name}`);
    console.log(`${post.comments.length} comments`);
  });
}
```

### User Profile

```typescript
const result = await db.users
  .where({ id: 1 })
  .include({
    profile: true,
    posts: true,
    comments: { as: 'userComments' }
  })
  .one();

if (result.success) {
  const user = result.data;
  console.log(user.profile);      // Profile object
  console.log(user.posts);        // Array of posts
  console.log(user.userComments); // Array of comments
}
```

## Performance Notes

- ✅ Includes use `IN (...)` queries for efficiency
- ✅ Only fetches related data for matched rows
- ✅ Deduplicates IDs automatically
- ❌ Nested includes not currently supported (e.g., `posts.comments`)
- ❌ Use separate queries for deep nesting

## Best Practices

- ✅ Use includes for related data you always need
- ✅ Name foreign keys consistently (`<table>Id` pattern)
- ✅ Add indexes on foreign key columns
- ❌ Don't over-include - fetch only what you need
- ❌ Don't use includes for large result sets (use pagination)

[Next: Learn migrations →](/docs/orm/migrations)
