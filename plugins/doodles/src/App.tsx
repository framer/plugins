import { useState, useRef } from "react";
import { framer } from "framer-plugin";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import * as Slider from "@radix-ui/react-slider";
import "./App.css";

function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
  event.target.select();
}

const drawStyles = {
  border: "none",
  backgroundColor: "transparent",
};

async function svgToBytes(svgText: string) {
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });

  const uint8Array = new Uint8Array(arrayBuffer);

  return uint8Array;
}

export async function getAssetDataFromSVG(svgString: string): Promise<string> {
  const encodedSvg = encodeURIComponent(svgString);
  const imageUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
  return imageUrl;
}
export function App() {
  const handleAddSvg = async (drawing: string) => {
    await framer.addImage({
      image: {
        type: "bytes",
        bytes: await svgToBytes(drawing),
        mimeType: "image/svg+xml",
      },
      name: "Doodle",
    });
  };

  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);
  const strokeHueInputRef = useRef<HTMLInputElement>(null);

  const [strokeValue, setStrokeValue] = useState(5);
  const [strokeInputValue, setStrokeInputValue] = useState("5");

  const [strokeHueInputValue, setStrokeHueInputValue] = useState("0");
  const [strokeSaturateInputValue, setStrokeSaturateInputValue] = useState("0");
  const [strokeLightInputValue, setStrokeLightInputValue] = useState("50");

  const [strokeColor, setStrokeColor] = useState({
    h: 0,
    s: 0,
    l: 50,
  });

  const handleStrokeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setStrokeInputValue(newValue);
  };

  const handleStrokeHueInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setStrokeHueInputValue(newValue);
  };

  const handleStrokeSaturateInput = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.value;
    setStrokeSaturateInputValue(newValue);
  };

  const handleStrokeLightInput = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.value;
    setStrokeLightInputValue(newValue);
  };

  function handleStrokeSliderChange(value: number[]) {
    setStrokeValue(value[0]);
    setStrokeInputValue(`${value[0]}`);
  }

  const handleStrokeInputKeydown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      const newValue = parseFloat(strokeInputValue);
      setStrokeValue(newValue);
    }
  };

  const handleStrokeHueInputKeydown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      const newValue = parseFloat(strokeHueInputValue);
      setStrokeColor({ ...strokeColor, h: newValue });
    }
  };

  const handleStrokeSaturateInputKeydown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      const newValue = parseFloat(strokeSaturateInputValue);
      setStrokeColor({ ...strokeColor, s: newValue });
    }
  };

  const handleStrokeLightInputKeydown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      const newValue = parseFloat(strokeLightInputValue);
      setStrokeColor({ ...strokeColor, l: newValue });
    }
  };

  return (
    <main>
      <div className="frame-info">
        <ReactSketchCanvas
          ref={canvasRef}
          style={drawStyles}
          className="canvas"
          width="230"
          height="230"
          strokeWidth={strokeValue}
          strokeColor={`hsl(${strokeColor.h} ${strokeColor.s}% ${strokeColor.l}%)`}
          backgroundImage="none"
        />
      </div>
      <section className="flex">
        <div className={"row history"}>
          <p>History</p>
          <button
            onClick={() => {
              if (!canvasRef.current) return;
              canvasRef.current.undo();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              className="left-arrow"
            >
              <path
                fill="transparent"
                stroke="var(--framer-color-text-secondary)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M7 1 3 5l4 4"
              />
            </svg>
          </button>
          <button
            onClick={() => {
              if (!canvasRef.current) return;
              canvasRef.current.redo();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              className="right-arrow"
            >
              <path
                fill="transparent"
                stroke="var(--framer-color-text-secondary)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="m3 1 4 4-4 4"
              />
            </svg>
          </button>
        </div>
        <div className={"row"}>
          <p>Stroke</p>
          <input
            type="number"
            placeholder="5"
            value={strokeInputValue}
            onChange={handleStrokeInput}
            onKeyDown={handleStrokeInputKeydown}
            onFocus={handleFocus}
            ref={strokeInputRef}
          />

          <Slider.Root
            className="SliderRoot"
            defaultValue={[5]}
            min={1}
            max={20}
            step={1}
            onValueChange={handleStrokeSliderChange}
            value={[strokeValue]}
          >
            <Slider.Track className="SliderTrack strokeWidth">
              <Slider.Range className="SliderRange" />
            </Slider.Track>
            <Slider.Thumb className="SliderThumb" />
          </Slider.Root>
        </div>
        <div className={"row"}>
          <p>Hue</p>
          <input
            type="number"
            placeholder="0"
            value={strokeHueInputValue}
            onChange={handleStrokeHueInput}
            onKeyDown={handleStrokeHueInputKeydown}
            onFocus={handleFocus}
            ref={strokeHueInputRef}
          />
          <Slider.Root
            className="SliderRoot hue"
            defaultValue={[0]}
            min={0}
            max={360}
            step={1}
            onValueChange={(newHue) => {
              setStrokeColor({ ...strokeColor, h: newHue[0] });
              setStrokeHueInputValue(`${newHue[0]}`);
            }}
            value={[strokeColor.h]}
          >
            <Slider.Track className="SliderTrack">
              <Slider.Range className="SliderRange" />
            </Slider.Track>
            <Slider.Thumb className="SliderThumb" />
          </Slider.Root>
        </div>
        <div className={"row"}>
          <p>Saturate</p>
          <input
            type="number"
            placeholder="0"
            value={strokeSaturateInputValue}
            onChange={handleStrokeSaturateInput}
            onKeyDown={handleStrokeSaturateInputKeydown}
            onFocus={handleFocus}
            ref={strokeInputRef}
          />
          <Slider.Root
            className="SliderRoot saturate"
            defaultValue={[0]}
            min={0}
            max={100}
            step={1}
            onValueChange={(newValue) => {
              setStrokeColor({ ...strokeColor, s: newValue[0] });
              setStrokeSaturateInputValue(`${newValue[0]}`);
            }}
            value={[strokeColor.s]}
          >
            <Slider.Track
              className="SliderTrack"
              style={{
                background: `linear-gradient(
                to left,
                hsl(${strokeColor.h}, 100%, 50%) 0%,
                hsl(${strokeColor.h}, 0%, 50%) 100%`,
              }}
            >
              <Slider.Range className="SliderRange" />
            </Slider.Track>
            <Slider.Thumb className="SliderThumb" />
          </Slider.Root>
        </div>
        <div className={"row"}>
          <p>Lightness</p>
          <input
            type="number"
            placeholder="50"
            value={strokeLightInputValue}
            onChange={handleStrokeLightInput}
            onKeyDown={handleStrokeLightInputKeydown}
            onFocus={handleFocus}
            ref={strokeInputRef}
          />
          <Slider.Root
            className="SliderRoot light"
            defaultValue={[50]}
            min={0}
            max={100}
            step={1}
            onValueChange={(newValue) => {
              setStrokeColor({ ...strokeColor, l: newValue[0] });
              setStrokeLightInputValue(`${newValue[0]}`);
            }}
            value={[strokeColor.l]}
          >
            <Slider.Track
              className="SliderTrack"
              style={{
                background: `linear-gradient(
                to right,
                hsl(${strokeColor.h}, ${strokeColor.s}%, 0%) 0%,
                hsl(${strokeColor.h}, ${strokeColor.s}%, 50%) 50%,

                hsl(${strokeColor.h}, ${strokeColor.s}%, 100%) 100%`,
              }}
            >
              <Slider.Range className="SliderRange" />
            </Slider.Track>
            <Slider.Thumb className="SliderThumb" />
          </Slider.Root>
        </div>
      </section>
      <div className="final-buttons">
        <button
          onClick={() => {
            if (!canvasRef.current) return;
            canvasRef.current.resetCanvas();
          }}
        >
          Clear
        </button>
        <button
          onClick={() => {
            if (canvasRef) {
              if (!canvasRef.current) return;
              canvasRef.current
                .exportSvg()
                .then((data) => {
                  handleAddSvg(data);
                })
                .catch((error) => {
                  console.log(error);
                });
            }
          }}
        >
          Add
        </button>
      </div>
    </main>
  );
}
