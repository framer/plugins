import { useEffect, useState } from "react";
import { CanvasNode, framer, withBackgroundImage } from "framer-plugin";
import { extractColors } from "extract-colors";
import { BrowserOptions } from "extract-colors/lib/types/Options";
import { FinalColor } from "extract-colors/lib/types/Color";
import { motion } from "framer-motion";
import "./App.css";

function generateGradient(colors: string[]): string {
  const step = 100 / (colors.length - 1);
  const deg = 90;
  let colorStops = "";

  colors.map((color: string, index: number) => {
    colorStops += color;

    if (index !== colors.length - 1) {
      colorStops += " " + index * step + "%, ";
    } else {
      colorStops += " " + index * step + "%";
    }

    return colorStops;
  });

  return `linear-gradient(${deg}deg, ${colorStops})`;
}

function useSelection() {
  const [selection, setSelection] = useState<CanvasNode[]>([]);

  useEffect(() => {
    return framer.subscribeToSelection(setSelection);
  }, []);

  return selection;
}

export function App() {
  const selection = useSelection();
  const [colors, setColors] = useState<FinalColor[]>([]);
  const currentSelection = selection[0];

  useEffect(() => {
    if (currentSelection) {
      if (withBackgroundImage(currentSelection)) {
        if (currentSelection.backgroundImage) {
          const url = currentSelection.backgroundImage.url;
          const options = {
            crossOrigin: "anonymous",
          };
          extractColors(url, options as BrowserOptions)
            .then((value) => {
              setColors(value);
            })
            .catch(console.error);
        }
      }
    }
  }, [selection]);

  const handleOnClick = async (node: CanvasNode, color: string) => {
    if (!node || !color) return;
    await framer.setAttributes(node.id, {
      backgroundColor: color,
    });
  };

  const setAsGradient = async (node: CanvasNode, colors: FinalColor[]) => {
    if (!node || !colors) return;

    const colorStops = colors.map((color: FinalColor) => {
      return color.hex;
    });

    const gradient = generateGradient(colorStops);

    await framer.setAttributes(node.id, {
      backgroundGradient: gradient,
    });
  };

  const colorList = colors.map((color: FinalColor) => {
    return (
      <motion.div
        className="color"
        whileHover={{
          flex: 2,
          cursor: "pointer",
        }}
        initial={{
          flex: 1,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 40,
          restDelta: 0.0001,
          restSpeed: 0.0001,
        }}
        onClick={() => {
          handleOnClick(currentSelection, color.hex);
        }}
        style={{ backgroundColor: color.hex }}
      ></motion.div>
    );
  });

  return (
    <main>
      {colors.length > 0 ? (
        <>
          <div className="interface">{colorList}</div>
          <button
            onClick={() => {
              setAsGradient(currentSelection, colors);
            }}
          >
            Set Gradient
          </button>
        </>
      ) : (
        <div className="placeholder">
          <p>Select an Image…</p>
        </div>
      )}
    </main>
  );
}
