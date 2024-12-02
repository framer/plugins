<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    selected: boolean;
    before: string;
    after: string;
    children: Snippet;
    onclick: () => void;
  }

  let { selected, before, after, onclick, children }: Props = $props();
</script>

<button class="replace-comparison" class:grid={after} class:selected {onclick}>
  <div class="before">
    <div class="icon">
      {@render children()}
    </div>

    <div class="label">
      {before}
    </div>
  </div>

  {#if after}
    <div class="chevron">
      <svg width="5px" height="8px" viewBox="0 0 5 8">
        <g
          stroke="none"
          stroke-width="1"
          fill="none"
          fill-rule="evenodd"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <g transform="translate(1, 1)" fill-rule="nonzero" stroke="currentColor" stroke-width="1.5">
            <polyline id="Path" points="0 6 3 3 0 0"></polyline>
          </g>
        </g>
      </svg>
    </div>

    <div class="after">
      <div class="icon">
        {@render children()}
      </div>

      <div class="label">
        {after}
      </div>
    </div>
  {/if}
</button>

<style>
  .replace-comparison {
    align-items: center;
    height: 30px;
    gap: 10px;
    width: 100%;
    user-select: none;
  }

  .replace-comparison,
  .replace-comparison:active,
  .replace-comparison:hover {
    background: none;
    text-align: left;
    font-weight: 500;
    padding: 0;
  }

  :global([data-framer-theme="dark"]) .replace-comparison {
    color: #999999;
  }

  :global([data-framer-theme="light"]) .replace-comparison {
    color: #666666;
  }

  .replace-comparison.grid {
    display: grid;
    grid-template-columns: 1fr 55px 1fr;
  }

  .chevron {
    place-self: center;
  }

  :global([data-framer-theme="dark"]) .chevron {
    color: #666666;
  }

  :global([data-framer-theme="light"]) .chevron {
    color: #999999;
  }

  .before,
  .after {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
  }

  .label {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    width: 100%;
  }

  .icon {
    flex-shrink: 0;
  }

  .before .icon {
    color: var(--framer-color-text-tertiary);
  }

  .after .icon {
    color: var(--framer-color-tint);
  }
</style>
