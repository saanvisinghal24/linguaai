import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Sparkles, CalendarDays, Target, Clock, BookOpen, RefreshCw } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const SKILLS = ['Grammar', 'Writing', 'Speaking', 'Vocabulary', 'Listening']
const EXAMS = ['', 'Goethe A1', 'Goethe A2', 'Goethe B1', 'Goethe B2', 'Goethe C1', 'DELF A1', 'DELF A2', 'DELF B1', 'DELF B2', 'JLPT N5', 'JLPT N4', 'HSK 3', 'HSK 4']

export default function StudyPlanPage() {
  const user = useAuthStore(s => s.user)
  const [mode, setMode] = useState('ai') // 'ai' or 'custom'
  const [customForm, setCustomForm] = useState({
    goal: '',
    focus_areas: [],
    hours_per_day: 1,
    exam_target: '',
    weeks: 1
  })
  const [aiPlan, setAiPlan] = useState(null)
  const [customPlan, setCustomPlan] = useState(null)

  // Auto-generated plan
  const { data: autoPlan, isLoading: loadingAuto, refetch } = useQuery({
    queryKey: ['study-plan'],
    queryFn: () => api.get('/progress/study-plan').then(r => r.data),
    staleTime: 0
  })

  // Custom plan
  const { mutate: generateCustom, isPending: generatingCustom } = useMutation({
    mutationFn: () => api.post('/progress/custom-plan', customForm),
    onSuccess: ({ data }) => setCustomPlan(data.plan),
    onError: (err) => alert(err.response?.data?.detail || 'Could not generate plan.')
  })

  const toggleFocusArea = (skill) => {
    setCustomForm(f => ({
      ...f,
      focus_areas: f.focus_areas.includes(skill)
        ? f.focus_areas.filter(s => s !== skill)
        : [...f.focus_areas, skill]
    }))
  }

  const plan = mode === 'ai' ? autoPlan?.plan : customPlan

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Study Plan</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">AI-generated or custom personalized study plans</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setMode('ai')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors
            ${mode === 'ai' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
          <Sparkles size={16} />
          AI Auto Plan
        </button>
        <button onClick={() => setMode('custom')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors
            ${mode === 'custom' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
          <Target size={16} />
          Custom Plan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Input */}
        <div className="lg:col-span-1">
          {mode === 'ai' ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Auto Plan</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                AI analyzes your current skill scores and creates an optimal 7-day plan automatically.
              </p>
              <div className="space-y-2 mb-4">
                {autoPlan?.scores && Object.entries(autoPlan.scores).map(([skill, score]) => (
                  <div key={skill} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{skill}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{score}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => refetch()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                <RefreshCw size={16} />
                Regenerate Plan
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-white">Custom Plan Builder</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Goal</label>
                <textarea value={customForm.goal}
                  onChange={e => setCustomForm({ ...customForm, goal: e.target.value })}
                  placeholder="e.g. Pass Goethe B1 in 3 months, improve my speaking confidence..."
                  className="w-full h-20 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Focus Areas</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map(skill => (
                    <button key={skill} onClick={() => toggleFocusArea(skill)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${customForm.focus_areas.includes(skill)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hours per day: <span className="text-blue-600">{customForm.hours_per_day}h</span>
                </label>
                <input type="range" min="0.5" max="4" step="0.5"
                  value={customForm.hours_per_day}
                  onChange={e => setCustomForm({ ...customForm, hours_per_day: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>30 min</span><span>4 hours</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan duration: <span className="text-blue-600">{customForm.weeks} week{customForm.weeks > 1 ? 's' : ''}</span>
                </label>
                <input type="range" min="1" max="4" step="1"
                  value={customForm.weeks}
                  onChange={e => setCustomForm({ ...customForm, weeks: parseInt(e.target.value) })}
                  className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 week</span><span>4 weeks</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Exam (optional)</label>
                <select value={customForm.exam_target}
                  onChange={e => setCustomForm({ ...customForm, exam_target: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No specific exam</option>
                  {EXAMS.filter(e => e).map(e => <option key={e}>{e}</option>)}
                </select>
              </div>

              <button onClick={() => generateCustom()} disabled={generatingCustom}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                {generatingCustom ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate My Plan</>}
              </button>
            </div>
          )}
        </div>

        {/* Right: Plan display */}
        <div className="lg:col-span-2">
          {(loadingAuto && mode === 'ai') || generatingCustom ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">Generating your study plan...</p>
            </div>
          ) : plan ? (
            <div className="space-y-4">
              {/* Plan header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
                <h3 className="font-bold text-lg mb-1">{plan.title || '7-Day Study Plan'}</h3>
                <p className="text-sm opacity-90">{plan.summary}</p>
              </div>

              {/* Weekly goals (custom plan) */}
              {plan.weekly_goals && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                    <Target size={16} className="text-blue-600" /> Weekly Goals
                  </h4>
                  <ul className="space-y-2">
                    {plan.weekly_goals.map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <span className="text-blue-600 font-bold mt-0.5">✓</span> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Days */}
              <div className="space-y-3">
                {plan.days?.map(day => (
                  <div key={day.day} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-sm">
                          {day.day}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-white text-sm">{day.focus}</p>
                          {day.tip && <p className="text-xs text-gray-400">{day.tip}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock size={12} />
                        {day.duration_minutes} min
                      </div>
                    </div>
                    <ul className="space-y-1.5 ml-11">
                      {day.tasks?.map((task, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <BookOpen size={12} className="text-blue-400 mt-1 flex-shrink-0" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Resources (custom plan) */}
              {plan.resources && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 text-sm">📚 Recommended Resources</h4>
                  <ul className="space-y-1">
                    {plan.resources.map((r, i) => (
                      <li key={i} className="text-sm text-blue-700 dark:text-blue-300">• {r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tip */}
              {(plan.tip || plan.final_tip) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300 italic">
                    💡 {plan.tip || plan.final_tip}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
              <CalendarDays size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {mode === 'ai' ? 'Click "Regenerate Plan" to get your study plan' : 'Fill in your details and click "Generate My Plan"'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}