# FormBuilder Plugin - Quick Usage Guide

## Overview
A self-contained form builder plugin integrated into the Kuratchi Editor. Build custom forms with drag-and-drop, manage email recipients, and configure auto-responders.

## Features
- **10 Field Types**: text, email, tel, number, textarea, select, checkbox, radio, date, file
- **Drag & Drop Builder**: Reorder fields with up/down arrows
- **Email Recipients**: Multiple email addresses for form submissions
- **Auto-Responder**: Automatic confirmation emails to users
- **Field Validation**: Required fields, regex patterns, min/max values
- **Flexible Layout**: Field widths from 25% to 100%
- **Live Preview**: See exactly how your form will look

## How to Use in Dashboard

### 1. Access the Forms Tab
In the editor, click the **Forms** icon (📄) in the left sidebar rail.

### 2. Create Your First Form
Click "New Form" or "Create First Form" to start.

### 3. Design Your Form (Design Tab)
- Click field type buttons to add fields (Text, Email, Textarea, etc.)
- Click a field to expand and edit its properties:
  - Label, placeholder, help text
  - Required checkbox
  - Field width (25%, 50%, 100%, etc.)
  - Validation rules
- Reorder fields with ↑↓ arrows
- Delete unwanted fields with trash icon

### 4. Configure Settings (Settings Tab)
**Basic Settings:**
- Form name
- Submit button text
- Success/error messages
- Optional redirect URL

**Email Recipients:**
- Add multiple email addresses
- Form submissions sent to all recipients

**Auto-Responder:**
- Toggle on/off
- Custom subject line
- Personalized message
- Optional reply-to address

**Styling:**
- Spacing (compact/normal/relaxed)
- Button colors
- Border radius

### 5. Preview (Preview Tab)
See your form rendered with all styling applied.

## Data Structure

Forms are stored in `siteMetadata.forms` as an array:

```typescript
{
  forms: [
    {
      id: "uuid",
      fields: [...],
      settings: {
        formName: "Contact Form",
        recipients: ["admin@example.com"],
        autoResponder: { enabled: true, ... },
        ...
      }
    }
  ]
}
```

## Integration Points

### Editor.svelte
- Forms tab in sidebar rail
- State management for forms array
- CRUD operations (create, update, delete)
- Auto-save to siteMetadata

### FormBuilder.svelte
- Self-contained plugin
- Three tabs: Design, Settings, Preview
- Inline field editing (no separate components)
- Handles all form configuration

### types.ts
- `FormData` interface
- `FormField` interface
- `FormSettings` interface
- `createDefaultFormData()` factory

## Next Steps

1. **Backend Integration**: Create API endpoints to handle form submissions
2. **Email Service**: Connect to your email service (SendGrid, SES, etc.)
3. **Spam Protection**: Add reCAPTCHA or similar
4. **Form Rendering**: Create a component to render forms on the frontend
5. **Submissions Dashboard**: View and manage form submissions

## Example: Contact Form

```typescript
{
  id: "contact-form-1",
  fields: [
    { type: "text", label: "Full Name", required: true, width: "100" },
    { type: "email", label: "Email", required: true, width: "50" },
    { type: "tel", label: "Phone", required: false, width: "50" },
    { type: "textarea", label: "Message", required: true, width: "100" }
  ],
  settings: {
    formName: "Contact Form",
    submitButtonText: "Send Message",
    recipients: ["support@example.com"],
    autoResponder: {
      enabled: true,
      subject: "Thank you for contacting us",
      message: "We'll respond within 24 hours."
    }
  }
}
```

## Files Modified

- ✅ `FormBuilder.svelte` - Self-contained plugin component
- ✅ `types.ts` - Form types and interfaces
- ✅ `plugins/index.ts` - Export FormBuilder
- ✅ `Editor.svelte` - Forms tab integration

All extra files removed - just one plugin file! 🎉
