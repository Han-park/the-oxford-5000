'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

// List of public routes that don't require authentication
const publicRoutes = ['/signin', '/signup', '/reset-password', '/test']

// List of protected routes that require authentication
const protectedRoutes = ['/', '/quiz', '/add', '/profile']

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Check if the current path is a protected route or starts with a protected route
  const isProtectedRoute = () => {
    return protectedRoutes.some(route => 
      pathname === route || 
      (route !== '/' && pathname.startsWith(route + '/'))
    )
  }

  useEffect(() => {
    // Skip the check if we're still loading or if we're on a public route
    if (loading || publicRoutes.includes(pathname)) {
      return
    }

    // If user is not authenticated and on a protected route, redirect to signin page
    if (!user && (isProtectedRoute() || !publicRoutes.includes(pathname))) {
      console.log('User not authenticated, redirecting to signin page from:', pathname)
      router.push('/signin')
    }
  }, [user, loading, router, pathname])

  // For debugging
  useEffect(() => {
    console.log('AuthCheck state:', { 
      isAuthenticated: !!user, 
      isLoading: loading, 
      currentPath: pathname,
      isPublicRoute: publicRoutes.includes(pathname),
      isProtectedRoute: isProtectedRoute()
    })
  }, [user, loading, pathname])

  // If we're on a public route, or the user is authenticated, render the children
  if (publicRoutes.includes(pathname) || user) {
    return <>{children}</>
  }

  // If we're still loading, show a loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Otherwise, render nothing while we redirect
  return null
} 