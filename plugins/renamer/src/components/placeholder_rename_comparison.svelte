<script lang="ts">
let { index, total, width }: { index: number; total: number; width: number } = $props()
</script>

<div class="placeholder-rename-comparison" style:animation-delay={`${index / 20}s`}>
  <div class="content" style:width="12px" style:opacity={1 - index / total}></div>
  <div class="content" style:width={`${width}%`} style:opacity={1 - index / total}></div>
</div>

<style>
  @keyframes pulse {
    0% {
      opacity: 0.3;
    }

    50% {
      opacity: 1;
    }

    100% {
      opacity: 0.3;
    }
  }

  .placeholder-rename-comparison {
    border-radius: 8px;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    width: 100%;
    height: 30px;
    gap: 7px;
    animation: pulse 1.5s ease infinite;
    animation-fill-mode: forwards;
  }

  .content {
    background: color-mix(in srgb, transparent, var(--framer-color-text) 10%);
    border-radius: 100px;
    height: 12px;
  }
</style>
