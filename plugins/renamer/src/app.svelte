<script lang="ts">
  import type { CanvasNode, IndexEntry, Result } from "./search/types";
  import type { CategoryFilter, Filter, TextFilter } from "./search/filters";

  import { fade } from "svelte/transition";
  import SearchReplace from "./components/search_replace.svelte";
  import { executeFilters } from "./search/execute_filters";
  import { framer } from "framer-plugin";
  import { Indexer } from "./search/indexer";
  import starsLightImage from "./assets/stars_light.png";
  import starsDarkImage from "./assets/stars_dark.png";
  import Results from "./components/results.svelte";
  import { BatchProcessResults } from "./search/batch_process_results";
  import Tabs from "./components/tabs.svelte";
  import { assertNever } from "./utils/assert";
  import { renameResult } from "./search/result_processors/rename_result";
  import { cleanUpResult } from "./search/result_processors/clean_up_result";

  const isAllowedToSetAttributes = framer.isAllowedTo("Node.setAttributes")

  let currentRootId: string | undefined = $state();
  let currentMode: "search" | "clean" = $state("search");

  let indexing: boolean = $state(false);
  let replacing: boolean = $state(false);
  let selectedNodeIds: string[] = $state([]);

  let index: Record<string, IndexEntry> = $state({});

  let textSearchFilter: TextFilter = $state({
    id: "text-search",
    type: "text",
    query: "",
    caseSensitive: false,
    regex: false,
  });
  let categoryFilter: CategoryFilter = $state({
    id: "category",
    type: "category",
    category: "all",
  });

  let filters: Filter[] = $state([textSearchFilter, categoryFilter]);
  let entries: IndexEntry[] = $derived(Object.values(index));
  let results: Result[] = $derived(executeFilters(filters, entries));

  let replacement: string = $state("");

  const indexer = new Indexer({
    scope: "page",
    includedNodeTypes: ["FrameNode", "SVGNode", "ComponentInstanceNode"],
    includedAttributes: [],

    onRestarted: () => {
      index = {};
      indexing = false;
    },

    onStarted: () => {
      indexing = true;
      resultsRenamer.setReady(false);
    },

    onUpsert: (entry) => {
      index[entry.id] = entry;
    },

    onCompleted: () => {
      indexing = false;
      resultsRenamer.setReady(true);
    },
  });

  const resultsRenamer = new BatchProcessResults({
    process: async (result: Result, node: CanvasNode) => {
      switch (currentMode) {
        case "search":
          await node.setAttributes({
            name: renameResult(result, replacement),
          });

          return;

        case "clean":
          await node.setAttributes({
            name: cleanUpResult(result),
          });

          return;

        default:
          assertNever(currentMode);
      }
    },

    onStarted: () => {
      replacing = true;
    },

    onProgress: (count, total) => {},

    onCompleted: () => {
      replacing = false;
      indexer.restart();
    },
  });

  const renameResults = () => {
    if (!isAllowedToSetAttributes) return

    resultsRenamer.start(results);
  };

  const throttle = (callback: () => void, delay: number = 1000) => {
    let timeout: number | null = null;

    return () => {
      if (timeout) return;

      timeout = setTimeout(() => {
        callback();
        timeout = null;
      }, delay);
    };
  };

  const throttledStartIndexer = throttle(() => {
    indexer.restart();
  });

  $effect(() => {
    return framer.subscribeToSelection((selection) => {
      selectedNodeIds = selection.map((node) => node.id);
    });
  });

  $effect(() => {
    currentRootId;
    indexer.restart();
  });

  $effect(() => {
    index = {};
    indexer.start();

    return framer.subscribeToCanvasRoot(async () => {
      const root = await framer.getCanvasRoot();
      currentRootId = root.id;

      if (replacing) return;

      throttledStartIndexer();
    });
  });
</script>

<div class="app">
  <Tabs
    items={[
      {
        label: "Search",
        active: () => currentMode === "search",
        select: () => (currentMode = "search"),
      },
      {
        label: "Clean",
        active: () => currentMode === "clean",
        select: () => (currentMode = "clean"),
      },
    ]}
  />

  <div class="results">
    {#if !textSearchFilter.query}
      <div class="empty-state" transition:fade={{ duration: 80 }}>
        <img class="light" src={starsLightImage} alt="Stars" />
        <img class="dark" src={starsDarkImage} alt="Stars" />
      </div>
    {/if}

    {#if textSearchFilter.query}
      <div class="list" transition:fade={{ duration: 80 }}>
        <Results
          query={textSearchFilter.query}
          {selectedNodeIds}
          {indexing}
          {results}
          getTextAfterRename={(result) => {
            switch (currentMode) {
              case "search":
                return renameResult(result, replacement);

              case "clean":
                return cleanUpResult(result);

              default:
                assertNever(currentMode);
            }
          }}
        />
      </div>
    {/if}
  </div>

  <SearchReplace
    bind:query={textSearchFilter.query}
    bind:replacement
    loading={replacing}
    disableAction={currentMode === "search" && !replacement}
    isAllowed={isAllowedToSetAttributes}
    showReplacement={currentMode === "search"}
    actionLabel={currentMode === "search" ? "Rename" : "Clean Up"}
    onRenameClick={renameResults}
  />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: absolute;
    padding: 0 15px 15px;
  }

  .results {
    position: relative;
    height: 100%;
    overflow: hidden;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    position: absolute;
    inset: 0;
  }

  :global([data-framer-theme="dark"]) .empty-state img.light {
    display: none;
  }

  :global([data-framer-theme="light"]) .empty-state img.dark {
    display: none;
  }

  .empty-state img {
    width: 200px;
  }

  .list {
    background-color: var(--framer-color-bg);
    position: absolute;
    inset: 0;
  }
</style>
