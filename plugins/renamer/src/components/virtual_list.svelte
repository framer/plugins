<script lang="ts" generics="Entry">
  import type { Snippet } from "svelte";

  import { fade } from "svelte/transition";

  interface Props {
    key: string;
    item: Snippet<[Entry, number]>;
    entries: Entry[];
    height?: number;
    trailingContent?: Snippet;
    paddingTop?: number;
  }

  let { key, item, entries, height = 30, trailingContent, paddingTop = 0 }: Props = $props();

  let scrollAreaElement: HTMLDivElement;

  let scrollTop = $state(0);
  let containerHeight = $derived(height * entries.length);
  let viewportHeight = $state(0);
  let totalViewportPages = $derived(Math.max(Math.floor(containerHeight / viewportHeight), 0));
  let itemsPerPage = $derived(Math.ceil(viewportHeight / height));
  let pageHeight = $derived(itemsPerPage * height);
  let currentPage = $state(0);
  let remainingPages = $state(0);

  let currentPageEntries = $derived(
    entries.slice(currentPage * itemsPerPage, currentPage * itemsPerPage + itemsPerPage),
  );
  let nextPageEntries = $derived(
    entries.slice((currentPage + 1) * itemsPerPage, (currentPage + 1) * itemsPerPage + itemsPerPage),
  );

  const scroll = () => {
    scrollTop = scrollAreaElement.scrollTop;

    currentPage = Math.floor(scrollTop / pageHeight);
    remainingPages = totalViewportPages - currentPage;
  };

  $effect(() => {
    scroll();
  });

  $effect(() => {
    key;
    scrollAreaElement.scrollTo(0, 0);
  });
</script>

<div class="virtual-list">
  {#if scrollTop > 0}
    <div class="overflow-gradient-top" transition:fade={{ duration: 250 }}></div>
  {/if}

  <div class="scroll-area" onscroll={scroll} bind:offsetHeight={viewportHeight} bind:this={scrollAreaElement}>
    <div
      class="container"
      style:height={`${pageHeight}px`}
      style:padding-top={`${currentPage * pageHeight + paddingTop}px`}
      style:padding-bottom={`${remainingPages * pageHeight}px`}
    >
      {#each currentPageEntries as entry, index}
        <div class="entry">
          {@render item(entry, itemsPerPage * currentPage + index)}
        </div>
      {/each}

      {#each nextPageEntries as entry, index}
        <div class="entry">
          {@render item(entry, itemsPerPage * (currentPage + 1) + index)}
        </div>
      {/each}

      {@render trailingContent?.()}
    </div>
  </div>

  <div class="overflow-gradient-bottom" transition:fade={{ duration: 250 }}></div>
</div>

<style>
  .virtual-list {
    height: 100%;
    position: relative;
  }

  .scroll-area {
    height: 100%;
    overflow-y: scroll;
  }

  .overflow-gradient-top {
    top: 0;
    background: linear-gradient(
      0deg,
      color-mix(in srgb, transparent, var(--framer-color-bg) 0%) 10%,
      color-mix(in srgb, transparent, var(--framer-color-bg) 100%)
    );
  }

  .overflow-gradient-bottom {
    bottom: 0;
    background: linear-gradient(
      0deg,
      color-mix(in srgb, transparent, var(--framer-color-bg) 100%) 10%,
      color-mix(in srgb, transparent, var(--framer-color-bg) 0%)
    );
  }

  .overflow-gradient-top,
  .overflow-gradient-bottom {
    width: 100%;
    height: 50px;
    position: absolute;
  }
</style>
