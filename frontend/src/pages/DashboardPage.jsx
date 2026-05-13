import { useQuery } from '@tanstack/react-query'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Mic, PenLine, BookOpen, Brain, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const skillIcons = { grammar: BookOpen, writing: PenLine, speaking: Mic, vocabulary: Brain, listening: LayoutDashboard }

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)

  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get('/progress/').then(r => r.data)
  })

  const { data: planData, isLoading: loadingPlan } = useQuery({
    queryKey: ['study-plan'],
    queryFn: () => api.get('/progress/study-plan').then(r => r.data),
    staleTime: 1000 * 60 * 60
  })

  const radarData = progress ? [
    { skill: 'Grammar',   score: progress.grammar },
    { skill: 'Writing',   score: progress.writing },
    { skill: 'Speaking',  score: progress.speaking },
    { skill: 'Vocab',     score: progress.vocabulary },
    { skill: 'Listening', score: progress.listening },
  ] : []

  const quickLinks = [
    { to: '/speaking',   icon: Mic,      label: 'Practice Speaking',  color: 'bg-green-50 text-green-700 border-green-200' },
    { to: '/writing',    icon: PenLine,  label: 'Evaluate Writing',   color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { to: '/grammar',    icon: BookOpen, label: 'Check Grammar',      color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { to: '/flashcards', icon: Brain,    label: 'Review Flashcards',  color: 'bg-orange-50 text-orange-700 border-orange-200' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name?.split(' ')[0]} 👋</h2>
        <p className="text-gray-500 mt-1">
          {user?.target_language} learner · CEFR Level <span className="font-semibold text-blue-600">{user?.cefr_level}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Your Skill Profile</h3>
          {loadingProgress ? (
            <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Score']} />
                <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {progress && Object.entries(progress).map(([skill, score]) => {
            const Icon = skillIcons[skill] || BookOpen
            return (
              <div key={skill} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={16} className="text-blue-500" />
                  <span className="text-sm font-medium text-gray-600 capitalize">{skill}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{score.toFixed(0)}<span className="text-sm text-gray-400 font-normal">%</span></p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${score}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {quickLinks.map(({ to, icon: Icon, label, color }) => (
          <Link key={to} to={to}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${color} hover:opacity-80 transition-opacity`}>
            <Icon size={24} />
            <span className="text-sm font-medium text-center">{label}</span>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">📅 Your 7-Day Study Plan</h3>
        {loadingPlan ? (
          <p className="text-gray-400 text-sm">Generating your personalized plan...</p>
        ) : planData?.plan ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 bg-blue-50 px-4 py-3 rounded-lg">{planData.plan.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {planData.plan.days?.map(day => (
                <div key={day.day} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-600 mb-1">Day {day.day}</p>
                  <p className="text-xs font-medium text-gray-700 mb-1">{day.focus}</p>
                  <p className="text-xs text-gray-500">{day.duration_minutes} min</p>
                </div>
              ))}
            </div>
            {planData.plan.tip && (
              <p className="text-sm text-gray-600 italic border-l-4 border-blue-300 pl-3">💡 {planData.plan.tip}</p>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Complete some exercises to generate your study plan.</p>
        )}
      </div>
    </div>
  )
}