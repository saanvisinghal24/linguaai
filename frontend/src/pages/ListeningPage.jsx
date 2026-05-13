import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Volume2, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const TOPICS = [
  'daily life', 'family', 'food and cooking', 'weather',
  'travel and transport', 'work and jobs', 'health and body',
  'hobbies and free time', 'shopping', 'school and education',
  'city and directions', 'festivals and celebrations'
]

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

export default function ListeningPage() {
  const user = useAuthStore(s => s.user)
  const [level, setLevel] = useState(user?.cefr_level || 'A1')
  const [topic, setTopic] = useState('daily life')
  const [exercise, setExercise] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)

  const { mutate: generateExercise, isPending: generating } = useMutation({
    mutationFn: () => api.post('/listening/generate', {
      language: user?.target_language || 'German',
      level,
      topic
    }),
    onSuccess: ({ data }) => {
      setExercise(data)
      setAnswers({})
      setResult(null)
      setShowTranslation(false)
    },
    onError: (err) => alert(err.response?.data?.detail || 'Could not generate exercise.')
  })

  const { mutate: submitAnswers, isPending: submitting } = useMutation({
    mutationFn: () => api.post('/listening/submit', {
      questions: exercise.questions,
      answers: exercise.questions.map((_, i) => answers[i] ?? -1)
    }),
    onSuccess: ({ data }) => setResult(data),
    onError: (err) => alert(err.response?.data?.detail || 'Could not submit answers.')
  })

  const playAudio = () => {
    if (!exercise?.audio_hex) return
    const bytes = new Uint8Array(exercise.audio_hex.match(/.{1,2}/g).map(b => parseInt(b, 16)))
    const blob = new Blob([bytes], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    setAudioPlaying(true)
    audio.play()
    audio.onended = () => setAudioPlaying(false)
  }

  const allAnswered = exercise?.questions?.every((_, i) => answers[i] !== undefined)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Listening Practice</h2>
        <p className="text-gray-500 mt-1">AI-generated audio exercises with comprehension questions</p>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Level</label>
            <div className="flex gap-2 flex-wrap">
              {LEVELS.map(l => (
                <button key={l} onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${level === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
            <select value={topic} onChange={e => setTopic(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TOPICS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => generateExercise()} disabled={generating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><RefreshCw size={16} /> New Exercise</>}
            </button>
          </div>
        </div>
      </div>

      {/* Exercise */}
      {generating && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Generating your listening exercise...</p>
          <p className="text-gray-400 text-sm mt-1">Creating audio and questions...</p>
        </div>
      )}

      {exercise && !generating && (
        <div className="space-y-4">
          {/* Audio player */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{exercise.title}</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                {user?.target_language} · {level}
              </span>
            </div>

            {/* Play button */}
            <button onClick={playAudio} disabled={!exercise.audio_hex || audioPlaying}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-medium transition-colors mb-4
                ${audioPlaying
                  ? 'bg-green-100 text-green-700 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'}`}>
              <Volume2 size={20} />
              {audioPlaying ? 'Playing audio...' : exercise.audio_hex ? 'Play Audio' : 'Audio unavailable'}
            </button>

            {/* Translation toggle */}
            <button onClick={() => setShowTranslation(s => !s)}
              className="text-sm text-blue-600 hover:underline">
              {showTranslation ? 'Hide translation' : 'Show English translation'}
            </button>

            {showTranslation && (
              <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm text-gray-600 italic">
                {exercise.english_translation}
              </div>
            )}
          </div>

          {/* Questions */}
          {!result && (
            <div className="space-y-4">
              {exercise.questions?.map((q, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="font-medium text-gray-800 mb-3">
                    {i + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, j) => (
                      <button key={j} onClick={() => setAnswers({ ...answers, [i]: j })}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors border
                          ${answers[i] === j
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
                        <span className="font-medium mr-2">{['A', 'B', 'C', 'D'][j]}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button onClick={() => submitAnswers()}
                disabled={!allAnswered || submitting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Answers'}
              </button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className={`rounded-2xl p-6 text-white text-center
                ${result.score >= 70 ? 'bg-green-600' : result.score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}>
                <p className="text-sm font-medium opacity-80 mb-1">Your Score</p>
                <p className="text-5xl font-bold">{result.score.toFixed(0)}%</p>
                <p className="text-sm opacity-80 mt-1">{result.correct} out of {result.total} correct</p>
              </div>

              {result.results.map((r, i) => (
                <div key={i} className={`bg-white rounded-xl border-2 p-4
                  ${r.is_correct ? 'border-green-200' : 'border-red-200'}`}>
                  <div className="flex items-start gap-3">
                    {r.is_correct
                      ? <CheckCircle size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                      : <XCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-800 mb-1">{r.question}</p>
                      {!r.is_correct && (
                        <p className="text-xs text-red-600">Your answer: {r.your_answer}</p>
                      )}
                      <p className="text-xs text-green-600 font-medium">Correct: {r.correct_answer}</p>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={() => generateExercise()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors">
                Try Another Exercise
              </button>
            </div>
          )}
        </div>
      )}

      {!exercise && !generating && (
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <Volume2 size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Select a level and topic, then click "New Exercise"</p>
          <p className="text-gray-400 text-sm mt-1">AI will generate audio and comprehension questions for you</p>
        </div>
      )}
    </div>
  )
}