import CesiumMap from "@/components/CesiumMap"

export default function MapPage() {
  return (
    <div style={{ margin: 0, padding: 0, width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <CesiumMap />
    </div>
  )
}
