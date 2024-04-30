import {
  Suspense,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import "./App.css";

// Grid
import { framer, Draggable } from "framer-plugin";
import Fuse from "fuse.js";

// Icons
import * as Icon from "react-icons/ri";
import { IconContext } from "react-icons";
import { renderToStaticMarkup } from "react-dom/server";

// Colors
import { Circle, RgbaColor } from "@uiw/react-color";

// Size
import * as Slider from "@radix-ui/react-slider";

interface IconEntry {
  name: string;
}

// Generate icon entries dynamically from MaterialDesign object keys
const icons: ReadonlyArray<IconEntry> = Object.keys(Icon).map(
  (iconName: string) => ({ name: iconName })
);

const fuse = new Fuse(icons, {
  keys: ["name"],
  threshold: 0.2,
  useExtendedSearch: true,
});

function IconGrid(props: any) {
  const { searchQuery, color, size, background } = props;

  const deferredQuery = useDeferredValue(searchQuery);

  const filteredIcons = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!query) return icons;

    return fuse.search(query).map((value) => value.item);
  }, [deferredQuery]);

  const handleIconClick = useCallback(
    async (entry: IconEntry, color: string) => {
      const IconComponent = Icon[entry.name as keyof typeof Icon];

      const svg = renderToStaticMarkup(
        <IconComponent size={`${size}px`} color={color} fill={color} />
      );

      await framer.addSVG({
        svg: svg,
        name: "Icon",
      });
    },
    []
  );

  if (filteredIcons.length === 0) {
    return (
      <div className="error-container">
        <p>No Results</p>
      </div>
    );
  }

  const rgbaString = `rgba(${background?.r}, ${background?.g}, ${background?.b}, 0.1)`;

  return (
    <div className="grid">
      {filteredIcons.map((entry: IconEntry) => {
        const IconComponent = Icon[entry.name as keyof typeof Icon];

        const isFirst = color === "#000000";
        const gridColor = isFirst ? "var(--framer-color-text)" : color;

        return (
          <Draggable
            data={() => ({
              type: "svg",
              name: "Icon",
              svg: renderToStaticMarkup(
                <IconComponent size={`${size}px`} color={color} fill={color} />
              ),
            })}
            key={entry.name}
          >
            <button
              className="icon-parent"
              style={{
                background: !isNaN(background?.r)
                  ? rgbaString
                  : "var(--framer-color-bg-tertiary)",
              }}
              onClick={() => handleIconClick(entry, color)}
            >
              <IconComponent size={`${size}px`} color={gridColor} />
            </button>
          </Draggable>
        );
      })}
    </div>
  );
}

export function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [hex, setHex] = useState("#000000");
  const [rgba, setRGBA] = useState<RgbaColor>();
  const [size, setSize] = useState(32);

  function handleSliderChange(value: number[]) {
    setSize(value[0]);
  }

  return (
    <>
      <div className="search-container">
        <input
          autoComplete="nope"
          autoCorrect="off"
          autoFocus
          className="search-input"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search…"
        />
      </div>

      <div className="color-section">
        <p className="color-label">Color</p>

        <Circle
          colors={[
            "var(--framer-color-text)",
            "#F44",
            "#F82",
            "#FB0",
            "#4DD",
            "#09F",
            "#46F",
            "#85F",
            "#E5F",
          ]}
          color={hex}
          className="color-picker"
          onChange={(color) => {
            setHex(color.hex);
            setRGBA(color.rgba);
          }}
        />
      </div>

      <Slider.Root
        className="SliderRoot"
        defaultValue={[32]}
        min={16}
        max={48}
        step={4}
        onValueChange={handleSliderChange}
        value={[size]}
      >
        <Slider.Track className="SliderTrack">
          <p className="left">Size</p>
          <p className="right">{size}</p>

          <Slider.Range className="SliderRange" />
        </Slider.Track>
      </Slider.Root>

      <div className="grid-container">
        <Suspense fallback={null}>
          <IconContext.Provider
            value={{
              size: `${size}px`,
              color: hex,
            }}
          >
            <IconGrid
              searchQuery={searchQuery}
              color={hex}
              size={size}
              background={rgba}
            />
          </IconContext.Provider>
        </Suspense>
      </div>
    </>
  );
}
