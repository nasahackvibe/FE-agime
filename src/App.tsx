import { useEffect, useRef } from "react";
import { Ion, Viewer } from "cesium";

function App() {
  // Your access token
  Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmM0MGZmMi1mM2E2LTQ0MmEtYjE4ZS1jMjFhOGEyYzMzZWUiLCJpZCI6MzM0NDM3LCJpYXQiOjE3NTU4NTkyOTF9.psLMJyO3td3N9F564Pgf5D_-USXQgKAT2vExPjxSpUs";
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (viewerRef.current && !cesiumViewerRef.current) {
      cesiumViewerRef.current = new Viewer(viewerRef.current, {
        terrainProvider: undefined, // You can add Cesium World Terrain later
      });
    }

    return () => {
      if (cesiumViewerRef.current) {
        cesiumViewerRef.current.destroy();
        cesiumViewerRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }} ref={viewerRef}></div>
  );
}

export default App;
