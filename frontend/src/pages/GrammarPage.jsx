import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function GrammarPage() {
  const user = useAuthStore(s => s.user)
  const [text, setText] = useState('')
  const [level, setLevel] = useState(user?.cefr_level || 'B1')
  const [result, setResult] = useState(null)

  const { mutate: checkGrammar, isPending } = useMutation({
    mutationFn: () => api.post('/grammar/check', {
      text, language: user?.target_language || 'German', cefr_level: level
    }),
    onSuccess: ({ data }) => setResult(data),
    onError: (err) => alert(JSON.stringify(err.response?.data) || 'Something went wrong.')
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Grammar Checker</h2>
        <p className="text-gray-500 mt-1">Write in {user?.target_language} and get detailed AI feedback</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium text-gray-700">Your CEFR Level:</label>
          <div className="flex gap-2">
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${level === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={`Write a sentence or paragraph in ${user?.target_language || 'your target language'}...`}
          className="w-full h-36 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => checkGrammar()} disabled={isPending || !text.trim()}
          className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors">
          {isPending ? <><Loader2 size={16} className="animate-spin" /> Checking...</> : 'Check Grammar'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={18} className="text-green-600" />
              <h3 className="font-semibold text-green-800">Corrected Version</h3>
            </div>
            <p className="text-gray-800">{result.corrected_text}</p>
          </div>

          {result.errors?.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''} found</h3>
              {result.errors.map((err, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <XCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-sm line-through">{err.original}</span>
                        <span className="text-gray-400">→</span>
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm font-medium">{err.correction}</span>
                      </div>
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">{err.rule}</p>
                      <p className="text-sm text-gray-600">{err.explanation}</p>
                      {err.advanced && (
                        <p className="text-sm text-gray-500 italic">💡 Advanced: <span className="text-gray-700 not-italic">{err.advanced}</span></p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-medium">🎉 No grammar errors found! Great job.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}