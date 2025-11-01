<script lang="ts">
    import { LayoutBlock } from "$lib/shell";
  
  interface Props {
    id?: string;
    type?: string;
    heading?: string;
    body?: string;
    button?: any;
    reverseOrder?: boolean;
    buttonColor?: string;
    headingColor?: string;
    textColor?: string;
    image?: any;
    backgroundColor?: string;
    showBackgroundImage?: boolean;
    backgroundImage?: string;
  }

  let {
    id = crypto.randomUUID(),
    type = 'hero-figure',
    heading = 'Hello There',
    body = 'Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi. In deleniti eaque aut repudiandae et a id nisi.',
    button = {
          link: '#',
          label: 'Read more'
      },
    reverseOrder = $bindable(false),
    buttonColor = $bindable('bg-base-200'),
    headingColor = $bindable('text-content'),
    textColor = $bindable('text-content'),
    image = {
          src: 'https://fakeimg.pl/489x600/?text=World&font=lobster',
          alt: 'Clutch CMS',
          title: 'Clutch CMS',
      },
    backgroundColor = $bindable('#ffffff'),
    showBackgroundImage = $bindable(true),
    backgroundImage = $bindable('https://img.daisyui.com/images/stock/photo-1507358522600-9f71e620c44e.webp')
  }: Props = $props();
  
  let content = $derived({
      backgroundColor: backgroundColor,
      textColor: textColor,
      reverseOrder: reverseOrder,
      showBackgroundImage: showBackgroundImage,
      backgroundImage: backgroundImage,
      type: type,
      image,
      button,
      buttonColor,
      headingColor
  })
  </script>
  
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="card-body">
            <div class="flex flex-wrap flex-col justify-between">
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Reverse Order</span>
                        <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={reverseOrder} />
                    </label>
                </div>

                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Component Background Color</span>
                        <input type="color" class="input-color ml-4" bind:value={backgroundColor} />
                    </label>
                </div>
                
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Text Color</span>
                        <input type="color" class="input-color ml-4" bind:value={textColor} />
                    </label>
                </div>

                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Show Background Image</span>
                        <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={showBackgroundImage} />
                    </label>
                </div>

                {#if showBackgroundImage}
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Background Image URL</span>
                        <input type="text" class="input input-bordered ml-4" bind:value={backgroundImage} />
                    </label>
                </div>
                {/if}

                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Button Color</span>
                        <input type="text" class="input input-bordered ml-4" bind:value={buttonColor} />
                    </label>
                </div>

                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Heading Color</span>
                        <input type="text" class="input input-bordered ml-4" bind:value={headingColor} />
                    </label>
                </div>

                <div class="divider"></div>
            </div>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div class="container mx-auto" style:background-color={backgroundColor}>
            <div class="hero h-96" style:backgroundImage={showBackgroundImage ? `url(${backgroundImage})` : ''}>
                <div class="hero-overlay bg-opacity-60"></div>
                <div class="hero-content text-neutral-content text-center">
                    <div class="max-w-md">
                        <h1 class="mb-5 text-5xl font-bold" style:color={headingColor}>{heading}</h1>
                        <p class="mb-5" style:color={textColor}>{body}</p>
                        <button class="btn {buttonColor}">{button.label}</button>
                    </div>
                </div>
            </div>
        </div>
    {/snippet}
</LayoutBlock>
