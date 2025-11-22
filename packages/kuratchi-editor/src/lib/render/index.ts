import type { ComponentType } from 'svelte';

import { getBlock } from '../registry/blocks.svelte';
import { getHeader } from '../registry/headers.svelte';
import { getFooter } from '../registry/footers.svelte';
import { getSection } from '../registry/sections.svelte';

type HeadingMetadata = Record<string, unknown> & { size?: string; color?: string };
type ParagraphMetadata = Record<string, unknown> & { color?: string };

export interface BlockRenderDefinition {
  component: ComponentType;
  props: Record<string, unknown>;
}

export function resolveBlockRender(block: Record<string, unknown> | null | undefined): BlockRenderDefinition | null {
  if (!block) return null;

  const rawType = block.type;
  if (typeof rawType !== 'string' || rawType.length === 0) {
    return null;
  }

  // Check headers first
  const headerDef = getHeader(rawType);
  if (headerDef?.component) {
    const props: Record<string, unknown> = { ...block };
    props.editable = false;
    return {
      component: headerDef.component as ComponentType,
      props
    };
  }

  // Check footers
  const footerDef = getFooter(rawType);
  if (footerDef?.component) {
    const props: Record<string, unknown> = { ...block };
    props.editable = false;
    return {
      component: footerDef.component as ComponentType,
      props
    };
  }

  // Check sections
  const sectionDef = getSection(rawType);
  if (sectionDef?.component) {
    const props: Record<string, unknown> = { ...block };
    props.editable = false;
    return {
      component: sectionDef.component as ComponentType,
      props
    };
  }

  // Fall back to blocks registry
  const blockEntry = getBlock(rawType);
  if (!blockEntry?.component) {
    return null;
  }

  const props: Record<string, unknown> = { ...block };

  switch (rawType) {
    case 'heading': {
      if (typeof props.heading !== 'string' && typeof props.text === 'string') {
        props.heading = props.text;
      }

      const metadataSource = (typeof props.metadata === 'object' && props.metadata !== null)
        ? (props.metadata as Record<string, unknown>)
        : {};
      const metadata = { ...metadataSource } as HeadingMetadata;
      if (typeof metadata.size !== 'string' || metadata.size.length === 0) {
        if (typeof props.level === 'number') {
          metadata.size = `h${Math.min(Math.max(props.level, 1), 6)}`;
        } else {
          metadata.size = 'h2';
        }
      }
      if (typeof metadata.color !== 'string' || metadata.color.length === 0) {
        metadata.color = '#000000';
      }
      props.metadata = metadata;
      break;
    }
    case 'paragraph': {
      if (typeof props.paragraph !== 'string' && typeof props.text === 'string') {
        props.paragraph = props.text;
      }
      const metadataSource = (typeof props.metadata === 'object' && props.metadata !== null)
        ? (props.metadata as Record<string, unknown>)
        : {};
      const metadata = { ...metadataSource } as ParagraphMetadata;
      if (typeof metadata.color !== 'string' || metadata.color.length === 0) {
        metadata.color = '#000000';
      }
      props.metadata = metadata;
      break;
    }
    default:
      break;
  }

  props.editable = false;

  return {
    component: blockEntry.component as ComponentType,
    props
  };
}
