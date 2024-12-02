<script lang="ts">
  let { checked = $bindable(), label }: { checked: boolean; label: string } = $props();
</script>

<div class="toggle-button">
  <input type="checkbox" bind:checked title={label} />
  <div class="button">
    <slot></slot>
  </div>
</div>

<style>
  .toggle-button {
    cursor: pointer;
    width: 22px;
    height: 22px;
    position: relative;
  }

  input[type="checkbox"] {
    cursor: pointer;
    position: absolute;
    border-radius: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    z-index: 2;
  }

  input[type="checkbox"]:checked + .button {
    background-color: var(--framer-color-tint-dimmed);
    color: var(--framer-color-tint);
  }

  input[type="checkbox"]:focus + .button {
    box-shadow: 0 0 0 1px var(--framer-color-tint);
  }

  .button {
    background: transparent;
    border-radius: 4px;
    color: var(--framer-color-text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    pointer-events: none;
    width: 100%;
    height: 100%;
    z-index: 1;
  }
</style>
