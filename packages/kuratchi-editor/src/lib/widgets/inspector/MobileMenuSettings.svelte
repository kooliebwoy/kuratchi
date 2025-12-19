<script lang="ts">
    import InspectorSection from './InspectorSection.svelte';
    import SelectControl from './SelectControl.svelte';
    import ColorControl from './ColorControl.svelte';

    type MobileStyle = 'drawer' | 'fullscreen';
    type DrawerPosition = 'left' | 'right';

    interface Props {
        style?: MobileStyle;
        drawerPosition?: DrawerPosition;
        backgroundColor?: string;
        textColor?: string;
        hoverBackgroundColor?: string;
        title?: string;
        hint?: string;
    }

    let {
        style = $bindable('drawer'),
        drawerPosition = $bindable('right'),
        backgroundColor = $bindable(''),
        textColor = $bindable(''),
        hoverBackgroundColor = $bindable(''),
        title = 'Mobile Menu',
        hint = 'Configure how the mobile navigation appears'
    }: Props = $props();

    const styleOptions = [
        { value: 'drawer', label: 'Drawer' },
        { value: 'fullscreen', label: 'Fullscreen' }
    ];

    const positionOptions = [
        { value: 'right', label: 'Right' },
        { value: 'left', label: 'Left' }
    ];
</script>

<InspectorSection {title} icon="📱" {hint}>
    <SelectControl 
        label="Menu Style" 
        bind:value={style} 
        options={styleOptions} 
    />
    
    {#if style === 'drawer'}
        <SelectControl 
            label="Drawer Position" 
            bind:value={drawerPosition} 
            options={positionOptions} 
        />
    {/if}

    <ColorControl 
        label="Background" 
        bind:value={backgroundColor} 
        placeholder="rgba(255,255,255,0.96)" 
    />
    
    <ColorControl 
        label="Text Color" 
        bind:value={textColor} 
        placeholder="#1f2937" 
    />
    
    <ColorControl 
        label="Hover Background" 
        bind:value={hoverBackgroundColor} 
        placeholder="auto" 
    />
</InspectorSection>

<style>
    /* Component uses child widgets, no additional styles needed */
</style>
