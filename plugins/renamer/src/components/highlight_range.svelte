<script lang="ts">
  import { iterate } from "../utils/array";
  import { matchCase, type Range } from "../utils/text";

  interface Props {
    title: string;
    replacement: string | undefined;
    ranges: Range[];
    preserveCase?: boolean;
    selected: boolean;
  }

  let { title, replacement, ranges, preserveCase = false, selected }: Props = $props();

  const texts: { text: string; highlighted: boolean }[] = [];

  for (const { current: currentRange, next: nextRange, isFirst: isFirstRange, isLast: isLastRange } of iterate(
    ranges,
  )) {
    if (isFirstRange) {
      texts.push({ text: title.slice(0, currentRange[0]), highlighted: false });
    }

    texts.push({ text: title.slice(...currentRange), highlighted: true });

    if (nextRange) {
      const inbetween: Range = [currentRange[1], nextRange[0]];

      const inbetweenLength = inbetween[1] - inbetween[0];
      if (inbetweenLength === 0) continue;

      texts.push({
        text: title.slice(inbetween[0], inbetween[1]),
        highlighted: false,
      });
    }

    if (isLastRange) {
      texts.push({
        text: title.slice(currentRange[1], title.length),
        highlighted: false,
      });
    }
  }
</script>

{#each texts as { text, highlighted }}
  {#if replacement && highlighted}
    <span class="old" class:selected>{text}</span>
    <span class="new" class:selected>{preserveCase ? matchCase(replacement, text) : replacement}</span>
  {:else}
    <span class:highlighted class:selected>{text}</span>
  {/if}
{/each}

<style>
  .highlighted {
    background: color-mix(in srgb, transparent, var(--framer-color-tint) 30%);
    border-radius: 2px;
    padding: 1px 0;
  }

  .highlighted.selected,
  :global([data-framer-theme="dark"]) .highlighted.selected {
    background: color-mix(in srgb, transparent, var(--framer-color-text-reversed) 30%);
  }

  :global([data-framer-theme="dark"]) .highlighted {
    background: color-mix(in srgb, transparent, var(--framer-color-tint) 50%);
  }

  .old {
    border-radius: 3px;
    color: color-mix(in srgb, transparent, var(--framer-color-text-tertiary) 60%);
    text-decoration: line-through;
  }

  .old.selected {
    color: color-mix(in srgb, transparent, var(--framer-color-text-reversed) 60%);
  }

  .new {
    border-radius: 3px;
    color: var(--framer-color-tint);
  }

  .new.selected {
    color: var(--framer-color-text-reversed);
    text-decoration: underline;
  }
</style>
