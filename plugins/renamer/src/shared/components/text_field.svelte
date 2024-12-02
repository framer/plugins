<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    value: string;
    placeholder: string;
    focused?: boolean;
    disabled?: boolean;
    leadingContent?: Snippet;
    onkeydown: (event: KeyboardEvent) => void;
  }

  let { value = $bindable(), placeholder, focused, disabled = false, leadingContent, onkeydown }: Props = $props();

  let inputElement: HTMLInputElement;

  const focusInput = () => {
    inputElement.focus();
  };

  $effect(() => {
    if (focused) {
      inputElement.focus();
    }
  });
</script>

<div class="text-field" onclick={focusInput} onkeydown={focusInput} role="textbox" tabindex="-1">
  {#if leadingContent}
    <div class="leading-content">
      {@render leadingContent?.()}
    </div>
  {/if}

  <input type="text" {placeholder} bind:value bind:this={inputElement} {disabled} {onkeydown} />
</div>

<style>
  .text-field {
    background-color: var(--framer-color-bg-tertiary);
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    height: 30px;
    position: relative;
    overflow: hidden;
  }

  .text-field:focus-within {
    box-shadow: 0 0 0 1px var(--framer-color-tint) inset;
  }

  .leading-content {
    color: var(--framer-color-text-tertiary);
    flex-shrink: 0;
    pointer-events: none;
  }

  input {
    background-color: transparent;
    width: 100%;
    height: 100%;
    padding: 0;
    flex-shrink: 1;
  }

  input:focus {
    box-shadow: none;
  }

  input::placeholder {
    color: #999999;
  }
</style>
