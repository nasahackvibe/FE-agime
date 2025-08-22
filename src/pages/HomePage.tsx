import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            NASA Hackathon - AGIME
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Advanced Geospatial Intelligence and Mapping Engine for Earth observation and analysis
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🗺️ Interactive Map
              </CardTitle>
              <CardDescription>
                Explore Earth with our advanced Cesium-powered 3D globe. Draw polygons, mark locations, and analyze geospatial data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/map">
                <Button className="w-full">
                  Launch Map Application
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔐 User Login
              </CardTitle>
              <CardDescription>
                Access your personalized dashboard and saved analysis projects. Secure authentication with multiple options.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  Sign In to Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Features</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow">
              <div className="text-3xl mb-4">🛰️</div>
              <h3 className="font-semibold mb-2">Satellite Imagery</h3>
              <p className="text-gray-600 text-sm">High-resolution satellite data visualization and analysis</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <div className="text-3xl mb-4">📍</div>
              <h3 className="font-semibold mb-2">Polygon Drawing</h3>
              <p className="text-gray-600 text-sm">Interactive polygon creation for area selection and analysis</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <div className="text-3xl mb-4">🌍</div>
              <h3 className="font-semibold mb-2">3D Globe</h3>
              <p className="text-gray-600 text-sm">Immersive 3D Earth exploration with smooth navigation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
