'use client'

import { LayoutIcon, PlusIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
        <Link 
          href="/"
          className={`flex flex-col items-center space-y-1 ${
            pathname === '/' ? 'text-blue-600' : 'text-gray-600'
          }`}
        >
          <LayoutIcon className="w-6 h-6" />
          <span className="text-xs">Dashboard</span>
        </Link>
        
        <Link 
          href="/quiz"
          className={`flex flex-col items-center space-y-1 ${
            pathname === '/quiz' ? 'text-blue-600' : 'text-gray-600'
          }`}
        >
          <MagnifyingGlassIcon className="w-6 h-6" />
          <span className="text-xs">Quiz</span>
        </Link>
        
        <Link 
          href="/add"
          className={`flex flex-col items-center space-y-1 ${
            pathname === '/add' ? 'text-blue-600' : 'text-gray-600'
          }`}
        >
          <PlusIcon className="w-6 h-6" />
          <span className="text-xs">Add</span>
        </Link>
      </div>
    </div>
  )
} 