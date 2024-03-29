import {
  PropsWithChildren,
  Suspense,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { UnsplashPhoto, getRandomPhoto, useListPhotosInfinite } from "./api";
import { framer, Draggable } from "@framerjs/plugin-api";
import { ErrorBoundary } from "react-error-boundary";
import { QueryErrorResetBoundary, useMutation } from "@tanstack/react-query";
import { Spinner } from "./Spinner";
import cx from "classnames";
import { SearchIcon } from "./icons";

const mode = await framer.getMode();

// TODO: API for resizable window
const windowWidth = mode === "default" ? 350 : 600;
const minColumnWidth = 100;
const columnGap = 8;
const sidePadding = 16 * 2;

void framer.showUI({ position: "top right", width: windowWidth, height: 400 });

export function App() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);

  const addRandomMutation = useMutation({
    mutationFn: async (query: string) => {
      const mode = await framer.getMode();
      const randomPhoto = await getRandomPhoto(query);

      await framer.addImage({
        image: randomPhoto.urls.full,
        name:
          randomPhoto.alt_description ??
          randomPhoto.description ??
          "Unsplash Image"
      });

      if (mode !== "default") {
        await framer.closePlugin();
      }
    }
  });

  return (
    <div className="px-4 flex flex-col gap-0 pb-4 h-full">
      <div className="bg-primary mb-2 z-10 relative">
        <input
          type="text"
          placeholder="Search..."
          value={query}
          className="w-full pr-8"
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center justify-center absolute right-2 top-0 bottom-0 text-tertiary">
          <SearchIcon />
        </div>
      </div>
      <AppErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <PhotosList query={debouncedQuery} />
        </Suspense>
      </AppErrorBoundary>
      <div className="mt-2">
        <button
          className="bg-tertiary text-secondary hover:bg-tertiary hover:text-primary focus:bg-tertiary focus:text-primary items-center flex justify-center relative"
          onClick={() => addRandomMutation.mutate(query)}
        >
          {addRandomMutation.isPending ? (
            <Spinner size="normal" inheritColor />
          ) : (
            "Random photo"
          )}
        </button>
      </div>
    </div>
  );
}

type PhotoId = string;

function PhotosList({ query }: { query: string }) {
  const { data, fetchNextPage, isFetchingNextPage, isLoading } =
    useListPhotosInfinite(query);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addPhotoMutation = useMutation({
    mutationFn: async (photo: UnsplashPhoto) => {
      const mode = await framer.getMode();
      await framer.addImage({
        image: photo.urls.full,
        name: photo.alt_description ?? photo.description ?? "Unsplash Image"
      });

      if (mode !== "default") {
        await framer.closePlugin();
      }
    }
  });

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (scrollElement) scrollElement.scrollTop = 0;
  }, [query]);

  const [photosColumns, columnWidth] = useMemo(() => {
    const adjustedWindowSize = windowWidth - sidePadding;
    const columnCount = Math.max(
      1,
      Math.floor(
        (adjustedWindowSize + columnGap) / (minColumnWidth + columnGap)
      )
    );
    const columnWidth =
      (adjustedWindowSize - (columnCount - 1) * columnGap) / columnCount;
    const heightPerColumn = Array(columnCount).fill(0);

    const seenPhotos = new Set<PhotoId>();
    const columns = Array.from(
      { length: columnCount },
      (): UnsplashPhoto[] => []
    );

    if (!data) return [columns, columnWidth];

    for (const page of data.pages) {
      // TODO: Cache pages?

      for (const photo of page.results) {
        // Could have duplicates with pagination
        if (seenPhotos.has(photo.id)) continue;

        const itemHeight = heightForPhoto(photo, columnWidth);

        const minColumnIndex = heightPerColumn.indexOf(
          Math.min(...heightPerColumn)
        );

        columns[minColumnIndex].push(photo);
        heightPerColumn[minColumnIndex] += itemHeight;
      }
    }
    return [columns, columnWidth] as const;
  }, [data]);

  const handleScroll = () => {
    if (isFetchingNextPage || isLoading) return;

    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const distanceToEnd =
      scrollElement.scrollHeight -
      (scrollElement.clientHeight + scrollElement.scrollTop);

    if (distanceToEnd > 150) return;

    fetchNextPage();
  };

  const isLoadingVisible = isLoading || isFetchingNextPage;

  if (!isLoadingVisible && photosColumns[0]?.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-tertiary">
        No photos found
      </div>
    );
  }

  return (
    <div
      className="overflow-auto relative"
      ref={scrollRef}
      onScroll={handleScroll}
    >
      <div className="relative">
        <div className="flex gap-2">
          {photosColumns.map((photos, i) => (
            <div
              key={`column-${i}`}
              className="flex-shrink-0 flex flex-col gap-1"
              style={{ width: columnWidth }}
            >
              {photos.map((photo) => (
                <GridItem
                  key={photo.id}
                  photo={photo}
                  height={heightForPhoto(photo, columnWidth)}
                  loading={
                    addPhotoMutation.isPending &&
                    addPhotoMutation.variables?.id === photo.id
                  }
                  onSelect={addPhotoMutation.mutate}
                />
              ))}
              {isLoadingVisible && <Placeholders index={i} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface GridItemProps {
  photo: UnsplashPhoto;
  height: number;
  loading: boolean;
  onSelect: (photo: UnsplashPhoto) => void;
}

const GridItem = memo(function GridItem({
  photo,
  loading,
  height,
  onSelect
}: GridItemProps) {
  const handleClick = () => onSelect(photo);

  return (
    <div key={photo.id} className="flex flex-col gap-1">
      <Draggable
        data={{ type: "image", image: photo.urls.full }}
        onClick={handleClick}
        className="cursor-pointer bg-cover relative"
        style={{
          height,
          backgroundImage: `url(${photo.urls.thumb})`,
          backgroundColor: photo.color
        }}
      >
        <div
          className={cx(
            "absolute top-0 right-0 left-0 bottom-0 rounded-lg flex items-center justify-center transition-all pointer-events-none",
            loading && "bg-blackDimmed"
          )}
        >
          {loading && <Spinner size="medium" />}
        </div>
      </Draggable>
      <a
        target="_blank"
        href={photo.user.links.html}
        className="text-2xs text-tertiary whitespace-nowrap overflow-hidden overflow-ellipsis"
      >
        {photo.user.name}
      </a>
    </div>
  );
});

const AppErrorBoundary = ({ children }: PropsWithChildren<object>) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary
        onReset={reset}
        fallbackRender={({ resetErrorBoundary }) => (
          <div className="flex flex-1 items-center justify-center flex-col max-w-[200px] m-auto text-tertiary">
            Could not load photos
            <button
              className="bg-transparent hover:bg-transparent active:bg-transparent text-blue-600 outline-none"
              onClick={() => resetErrorBoundary()}
            >
              Try again
            </button>
          </div>
        )}
      >
        {children}
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);

const placeholderHeights = [
  [120, 70, 90],
  [70, 140, 120],
  [140, 60, 70],
  [90, 130, 60]
];

const Placeholders = ({ index }: { index: number }) => {
  const heights = placeholderHeights[index % placeholderHeights.length];

  return heights.map((height) => (
    <div key={height} className="animate-pulse">
      <div className="bg-tertiary rounded-md" style={{ height }} />
      <div className="mt-1 bg-tertiary rounded-md h-[8px]" />
    </div>
  ));
};

function heightForPhoto(photo: UnsplashPhoto, columnWidth: number) {
  const ratio = photo.width / photo.height;
  return columnWidth / ratio;
}

function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedValue(value), delay);

    return () => {
      clearTimeout(debounce);
    };
  }, [value, delay]);

  return debouncedValue;
}
