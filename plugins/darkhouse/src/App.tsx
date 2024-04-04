import { useEffect, useState } from "react";
import { framer } from "framer-plugin";
import "./App.css";
import { PublishInfo } from "framer-plugin/src/api/publishInfo";

void framer.showUI({
  title: "Darkhouse",
  position: "top left",
  width: 270,
  height: 95,
});

function usePublishInfo() {
  const [publishInfo, setPublishInfo] = useState<PublishInfo>();

  useEffect(() => {
    return framer.subscribeToPublishInfo(setPublishInfo);
  }, []);

  return publishInfo;
}

export function App() {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunDarkhouse = async () => {
    if (!publishInfo?.production?.currentPageUrl) return;

    setIsRunning(true);
    void framer.showUI({
      height: 500,
    });
  };

  const closeDarkHouse = () => {
    setIsRunning(false);
    void framer.showUI({
      width: 270,
      height: 95,
    });
  };

  const publishInfo = usePublishInfo();

  let pagePath;

  if (publishInfo) {
    pagePath = publishInfo?.production?.currentPageUrl.replace(
      publishInfo?.production?.url,
      ""
    );
    if (pagePath === "/") {
      pagePath = "Home";
    }
  }

  let darkhouseUrl = `https://dark.house.dev/?url=${publishInfo?.production?.currentPageUrl}`;

  return (
    <main>
      {isRunning ? (
        <>
          <iframe src={darkhouseUrl}></iframe>
          <button onClick={closeDarkHouse}>Close</button>
        </>
      ) : (
        <>
          <p>
            Run Darkhouse to find actionable ways to improve your SEO and
            performance.
          </p>

          <button
            key={isRunning ? "running" : "not-running"}
            disabled={!pagePath}
            className="framer-button-primary"
            onClick={handleRunDarkhouse}
          >
            Analyze {pagePath}
          </button>
        </>
      )}
    </main>
  );
}
