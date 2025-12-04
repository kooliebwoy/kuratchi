/**
 * Export blocks to HTML
 * 
 * This module converts editor blocks (BlockSnapshot[]) to HTML string
 * for use in emails, static rendering, or other purposes.
 */

import type { BlockSnapshot } from '../types';

/**
 * Convert a single block to HTML
 */
function blockToHtml(block: BlockSnapshot): string {
	switch (block.type) {
		case 'heading': {
			const tag = (block.metadata as any)?.size || 'h2';
			const color = (block.metadata as any)?.color;
			const style = color ? ` style="color: ${color}"` : '';
			return `<${tag}${style}>${block.heading || ''}</${tag}>`;
		}

		case 'paragraph': {
			const color = (block.metadata as any)?.color;
			const style = color ? ` style="color: ${color}"` : '';
			return `<p${style}>${block.paragraph || ''}</p>`;
		}

		case 'button': {
			const text = block.text || 'Click me';
			const url = block.url || '#';
			const metadata = block.metadata as any || {};
			const target = metadata.target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
			const style = metadata.style || 'primary';
			const size = metadata.size || 'md';
			
			// Generate inline styles for email compatibility
			const buttonStyles = getButtonStyles(style, size);
			
			return `<div style="text-align: center; padding: 1rem 0;">
	<a href="${url}"${target} style="${buttonStyles}">${text}</a>
</div>`;
		}

		case 'divider': {
			return `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />`;
		}

		case 'list': {
			const metadata = block.metadata as any || {};
			const listType = metadata.listType || 'ul';
			const items = metadata.items || [];
			const itemsHtml = items.map((item: string) => `<li>${item}</li>`).join('\n');
			return `<${listType}>\n${itemsHtml}\n</${listType}>`;
		}

		case 'checklist': {
			const items = (block.items as any[]) || [];
			const itemsHtml = items
				.map((item: any) => {
					const checked = item.checked ? '☑' : '☐';
					return `<li style="list-style: none;">${checked} ${item.text || ''}</li>`;
				})
				.join('\n');
			return `<ul style="padding-left: 0;">\n${itemsHtml}\n</ul>`;
		}

		case 'image': {
			const src = block.src || block.url || '';
			const alt = block.alt || '';
			const caption = block.caption || '';
			
			let html = `<figure style="margin: 1rem 0; text-align: center;">
	<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto;" />`;
			
			if (caption) {
				html += `\n	<figcaption style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">${caption}</figcaption>`;
			}
			
			html += '\n</figure>';
			return html;
		}

		case 'grid':
		case 'two-column': {
			// For grid/columns, recursively render children
			const columns = (block.columns as any[]) || [];
			const columnWidth = Math.floor(100 / (columns.length || 1));
			
			const columnsHtml = columns.map((col: any) => {
				const blocks = col.blocks || [];
				const innerHtml = blocksToHtml(blocks);
				return `<td style="width: ${columnWidth}%; vertical-align: top; padding: 0 0.5rem;">${innerHtml}</td>`;
			}).join('\n');
			
			return `<table style="width: 100%; border-collapse: collapse;" cellpadding="0" cellspacing="0">
	<tr>
		${columnsHtml}
	</tr>
</table>`;
		}

		default:
			// Unknown block type - try to extract text content
			if (typeof block.text === 'string') {
				return `<p>${block.text}</p>`;
			}
			if (typeof block.content === 'string') {
				return `<p>${block.content}</p>`;
			}
			return '';
	}
}

/**
 * Generate inline button styles for email compatibility
 */
function getButtonStyles(style: string, size: string): string {
	const baseStyles = [
		'display: inline-block',
		'border-radius: 9999px',
		'text-decoration: none',
		'font-weight: 600',
		'text-align: center'
	];

	// Size styles
	switch (size) {
		case 'xs':
			baseStyles.push('padding: 0.25rem 0.75rem', 'font-size: 0.75rem');
			break;
		case 'sm':
			baseStyles.push('padding: 0.4rem 1rem', 'font-size: 0.8rem');
			break;
		case 'lg':
			baseStyles.push('padding: 0.75rem 1.5rem', 'font-size: 1rem');
			break;
		default: // md
			baseStyles.push('padding: 0.5rem 1.25rem', 'font-size: 0.9rem');
	}

	// Style colors
	switch (style) {
		case 'secondary':
			baseStyles.push('background-color: #ffffff', 'color: #111827', 'border: 1px solid #e5e7eb');
			break;
		case 'accent':
			baseStyles.push('background-color: #4f46e5', 'color: #f9fafb');
			break;
		case 'ghost':
			baseStyles.push('background-color: transparent', 'color: #111827', 'border: 1px solid #e5e7eb');
			break;
		default: // primary
			baseStyles.push('background-color: #111827', 'color: #f9fafb');
	}

	return baseStyles.join('; ');
}

/**
 * Convert an array of blocks to HTML string
 */
export function blocksToHtml(blocks: BlockSnapshot[]): string {
	if (!Array.isArray(blocks)) return '';
	
	return blocks
		.map(block => blockToHtml(block))
		.filter(html => html.trim() !== '')
		.join('\n\n');
}

/**
 * Convert blocks to a complete email HTML document
 */
export function blocksToEmailHtml(blocks: BlockSnapshot[], options?: {
	title?: string;
	previewText?: string;
	backgroundColor?: string;
	maxWidth?: string;
}): string {
	const {
		title = '',
		previewText = '',
		backgroundColor = '#f3f4f6',
		maxWidth = '600px'
	} = options || {};

	const contentHtml = blocksToHtml(blocks);
	
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<title>${title}</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			background-color: ${backgroundColor};
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			font-size: 16px;
			line-height: 1.6;
			color: #111827;
		}
		h1, h2, h3, h4, h5, h6 {
			margin: 0 0 1rem 0;
			font-weight: 700;
			line-height: 1.2;
		}
		h1 { font-size: 2rem; }
		h2 { font-size: 1.5rem; }
		h3 { font-size: 1.25rem; }
		h4 { font-size: 1.125rem; }
		h5 { font-size: 1rem; }
		h6 { font-size: 0.875rem; }
		p {
			margin: 0 0 1rem 0;
		}
		ul, ol {
			margin: 0 0 1rem 0;
			padding-left: 1.5rem;
		}
		li {
			margin-bottom: 0.5rem;
		}
		a {
			color: #4f46e5;
		}
		img {
			max-width: 100%;
			height: auto;
		}
	</style>
</head>
<body>
	${previewText ? `<div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>` : ''}
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${backgroundColor};">
		<tr>
			<td align="center" style="padding: 2rem 1rem;">
				<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: ${maxWidth}; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
					<tr>
						<td style="padding: 2rem;">
							${contentHtml}
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;
}

/**
 * Convert blocks to plain text (for email text fallback)
 */
export function blocksToText(blocks: BlockSnapshot[]): string {
	if (!Array.isArray(blocks)) return '';

	return blocks
		.map(block => {
			switch (block.type) {
				case 'heading':
					return stripHtml(block.heading as string || '');
				case 'paragraph':
					return stripHtml(block.paragraph as string || '');
				case 'button':
					return `${block.text || 'Link'}: ${block.url || ''}`;
				case 'divider':
					return '---';
				case 'list': {
					const metadata = block.metadata as any || {};
					const items = metadata.items || [];
					const isOrdered = metadata.listType === 'ol';
					return items.map((item: string, i: number) => 
						isOrdered ? `${i + 1}. ${item}` : `• ${item}`
					).join('\n');
				}
				case 'checklist': {
					const items = (block.items as any[]) || [];
					return items.map((item: any) => 
						`[${item.checked ? 'x' : ' '}] ${item.text || ''}`
					).join('\n');
				}
				case 'image':
					return block.caption ? `[Image: ${block.caption}]` : '[Image]';
				default:
					if (typeof block.text === 'string') return stripHtml(block.text);
					if (typeof block.content === 'string') return stripHtml(block.content);
					return '';
			}
		})
		.filter(text => text.trim() !== '')
		.join('\n\n');
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.trim();
}
