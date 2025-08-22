import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function Navigation() {
  const location = useLocation()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-xl font-bold text-gray-900">
              NASA Hackathon
            </Link>
            <div className="flex space-x-4">
              <Link to="/map">
                <Button 
                  variant={location.pathname === '/map' ? 'default' : 'ghost'}
                  className="h-9"
                >
                  🗺️ Map
                </Button>
              </Link>
              <Link to="/login">
                <Button 
                  variant={location.pathname === '/login' ? 'default' : 'ghost'}
                  className="h-9"
                >
                  🔐 Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button 
                  variant={location.pathname === '/signup' ? 'default' : 'ghost'}
                  className="h-9"
                >
                  📝 Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
