<script lang="ts">
import iconSearch from "../assets/icon_search.svg?raw"
import Spinner from "./spinner.svelte"
import TextField from "./text_field.svelte"

interface Props {
    query: string
    replacement: string
    loading: boolean
    disableAction: boolean
    actionLabel: string
    showReplacement: boolean
    isAllowed: boolean
    onRenameClick?: () => void
}

let {
    query = $bindable(),
    replacement = $bindable(),
    loading,
    disableAction,
    actionLabel,
    showReplacement,
    isAllowed,
    onRenameClick = () => {},
}: Props = $props()

const handleTextFieldKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
        onRenameClick()
    }
}
</script>

<div class="search-replace">
  <TextField placeholder="Find" bind:value={query} focused disabled={loading} onkeydown={handleTextFieldKeyDown}>
    {#snippet leadingContent()}
      {@html iconSearch}
    {/snippet}
  </TextField>

  {#if showReplacement}
    <TextField
      placeholder="Rename To…"
      bind:value={replacement}
      disabled={loading}
      onkeydown={handleTextFieldKeyDown}
    />
  {/if}

  <button
    class="rename-button"
    onclick={onRenameClick}
    disabled={!query || disableAction || !isAllowed}
    title={isAllowed ? undefined : "Insufficient permissions"}
  >
    {#if loading}
      <Spinner type="solid" />
    {:else}
      {actionLabel}
    {/if}
  </button>
</div>

<style>
  .search-replace {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rename-button {
    background: #111111;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }

  :global([data-framer-theme="dark"]) .rename-button {
    background: white;
    color: #111111;
  }
</style>
