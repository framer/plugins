<script lang="ts">
  interface TabItem {
    label: string;
    active: () => boolean;
    select: () => void;
  }

  interface Props {
    items: TabItem[];
  }

  let { items }: Props = $props();
</script>

<div class="tabs">
  {#each items as item}
    <button class="tab" class:active={item.active()} onclick={item.select}>
      {item.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    align-items: center;
    height: 52px;
    flex-shrink: 0;
    border-top: 1px solid var(--framer-color-divider);
    border-bottom: 1px solid var(--framer-color-divider);
  }

  .tab {
    background: none;
    border: 0;
    width: auto;
    padding: 0;
    color: #999999;
    font-weight: 600;
    user-select: none;
    padding: 0 5px;
    transition: color 200ms ease;
  }

  .tab:first-child {
    padding-left: 0;
  }

  .tab:active {
    background: none;
  }

  .tab.active {
    color: var(--framer-color-text);
  }
</style>
