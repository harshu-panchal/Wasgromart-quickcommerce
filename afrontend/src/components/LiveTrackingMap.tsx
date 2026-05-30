import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GoogleMap,
  Marker,
  Polyline,
  InfoWindow,
  useJsApiLoader,
} from '@react-google-maps/api'
import { motion } from 'framer-motion'

type Libraries = ('places' | 'drawing' | 'geometry' | 'visualization')[]
const libraries: Libraries = ['places', 'geometry']

interface Location {
    lat: number
    lng: number
}

interface LiveTrackingMapProps {
    storeLocation: Location
    customerLocation: Location
    deliveryLocation?: Location
    isTracking: boolean
}

const containerStyle = { width: '100%', height: '100%' }

const emojiIcon = (emoji: string, size = 40) => ({
    url: `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><text x="4" y="${Math.round(size * 0.8)}" font-size="${Math.round(size * 0.8)}">${emoji}</text></svg>`
    )}`,
    scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(size, size) : undefined,
    anchor: window.google?.maps?.Point ? new window.google.maps.Point(size / 2, size / 2) : undefined,
} as google.maps.Icon)

export default function LiveTrackingMap({
    storeLocation,
    customerLocation,
    deliveryLocation,
    isTracking = false,
}: LiveTrackingMapProps) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: apiKey,
        libraries,
    })

    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<google.maps.Map | null>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [openInfo, setOpenInfo] = useState<'store' | 'customer' | 'delivery' | null>(null)

    const defaultCenter = useMemo<Location>(
        () => ({
            lat: (storeLocation.lat + customerLocation.lat) / 2,
            lng: (storeLocation.lng + customerLocation.lng) / 2,
        }),
        [storeLocation.lat, storeLocation.lng, customerLocation.lat, customerLocation.lng]
    )

    const routePoints = useMemo<Location[]>(() => {
        return [
            storeLocation,
            ...(deliveryLocation ? [deliveryLocation] : []),
            customerLocation,
        ]
    }, [storeLocation, customerLocation, deliveryLocation])

    // Fit bounds whenever the route points change so all markers stay visible.
    useEffect(() => {
        if (!isLoaded || !mapRef.current || !window.google?.maps) return
        const bounds = new window.google.maps.LatLngBounds()
        routePoints.forEach((p) => bounds.extend(p))
        if (!bounds.isEmpty()) {
            mapRef.current.fitBounds(bounds, 48)
        }
    }, [isLoaded, routePoints])

    const handleFullscreen = () => {
        if (!document.fullscreenElement && mapContainerRef.current) {
            mapContainerRef.current.requestFullscreen()
            setIsFullscreen(true)
        } else if (document.fullscreenElement) {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    if (loadError) {
        return (
            <div className="relative h-64 overflow-hidden rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-sm text-red-700 p-4 text-center">
                Failed to load Google Maps. Check the API key configuration.
            </div>
        )
    }

    if (!apiKey) {
        return (
            <div className="relative h-64 overflow-hidden rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-sm text-amber-800 p-4 text-center">
                Set <code className="mx-1 px-1 rounded bg-amber-100">VITE_GOOGLE_MAPS_API_KEY</code> to load the map.
            </div>
        )
    }

    if (!isLoaded) {
        return (
            <div className="relative h-64 overflow-hidden rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-center text-sm text-neutral-500">
                Loading map...
            </div>
        )
    }

    return (
        <div ref={mapContainerRef} className="relative h-64 overflow-hidden rounded-lg">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={defaultCenter}
                zoom={13}
                onLoad={(m) => {
                    mapRef.current = m
                }}
                onUnmount={() => {
                    mapRef.current = null
                }}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    clickableIcons: false,
                }}
            >
                <Marker
                    position={storeLocation}
                    icon={emojiIcon('🏪', 40)}
                    onClick={() => setOpenInfo('store')}
                    title="Store Location"
                >
                    {openInfo === 'store' && (
                        <InfoWindow onCloseClick={() => setOpenInfo(null)}>
                            <div className="text-center text-xs">
                                <p className="font-semibold text-sm">Store Location</p>
                                <p className="text-gray-600">Pickup point</p>
                            </div>
                        </InfoWindow>
                    )}
                </Marker>

                <Marker
                    position={customerLocation}
                    icon={emojiIcon('📍', 40)}
                    onClick={() => setOpenInfo('customer')}
                    title="Delivery Address"
                >
                    {openInfo === 'customer' && (
                        <InfoWindow onCloseClick={() => setOpenInfo(null)}>
                            <div className="text-center text-xs">
                                <p className="font-semibold text-sm">Delivery Address</p>
                                <p className="text-gray-600">Your location</p>
                            </div>
                        </InfoWindow>
                    )}
                </Marker>

                {deliveryLocation && (
                    <Marker
                        position={deliveryLocation}
                        icon={emojiIcon('🛵', 40)}
                        onClick={() => setOpenInfo('delivery')}
                        title="Delivery Partner"
                    >
                        {openInfo === 'delivery' && (
                            <InfoWindow onCloseClick={() => setOpenInfo(null)}>
                                <div className="text-center text-xs">
                                    <p className="font-semibold text-sm">Delivery Partner</p>
                                    <p className="text-gray-600">{isTracking ? 'On the way' : 'Location'}</p>
                                </div>
                            </InfoWindow>
                        )}
                    </Marker>
                )}

                <Polyline
                    path={routePoints}
                    options={{
                        strokeColor: '#16a34a',
                        strokeWeight: 4,
                        strokeOpacity: 0.7,
                        geodesic: true,
                        icons: [
                            {
                                icon: {
                                    path: 'M 0,-1 0,1',
                                    strokeOpacity: 1,
                                    scale: 4,
                                },
                                offset: '0',
                                repeat: '20px',
                            },
                        ],
                    }}
                />
            </GoogleMap>

            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                <motion.button
                    className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFullscreen}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                </motion.button>
            </div>

            {isTracking && (
                <div className="absolute bottom-3 left-3 z-10 bg-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <motion.div
                        className="w-2 h-2 rounded-full bg-green-500"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="text-sm font-medium text-gray-900">Live Tracking</span>
                </div>
            )}
            {isFullscreen && (
                <span className="sr-only">Fullscreen</span>
            )}
        </div>
    )
}
