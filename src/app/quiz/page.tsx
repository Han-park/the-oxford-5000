'use client'

import ProtectedRoute from '../../components/ProtectedRoute'
import WordQuiz from '../../components/WordQuiz'

export default function QuizPage() {
  return (
    <ProtectedRoute>
      <WordQuiz />
    </ProtectedRoute>
  )
}