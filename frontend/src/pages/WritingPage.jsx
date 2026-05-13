import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, FileText, RefreshCw } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const EXAM_LANGUAGES = {
  'Goethe A1': { lang: 'German', level: 'A1', words: 30 },
  'Goethe A2': { lang: 'German', level: 'A2', words: 60 },
  'Goethe B1': { lang: 'German', level: 'B1', words: 100 },
  'Goethe B2': { lang: 'German', level: 'B2', words: 200 },
  'Goethe C1': { lang: 'German', level: 'C1', words: 350 },
  'DELF A1':   { lang: 'French', level: 'A1', words: 40 },
  'DELF A2':   { lang: 'French', level: 'A2', words: 60 },
  'DELF B1':   { lang: 'French', level: 'B1', words: 160 },
  'DELF B2':   { lang: 'French', level: 'B2', words: 250 },
  'JLPT N5':   { lang: 'Japanese', level: 'N5', words: 50 },
  'JLPT N4':   { lang: 'Japanese', level: 'N4', words: 100 },
  'HSK 3':     { lang: 'Chinese', level: 'HSK3', words: 80 },
  'HSK 4':     { lang: 'Chinese', level: 'HSK4', words: 150 },
  'Free Write':{ lang: 'English', level: 'B1', words: 150 },
}

const EXAM_TYPES = Object.keys(EXAM_LANGUAGES)

export default function WritingPage() {
  const user = useAuthStore(s => s.user)
  const [examType, setExamType] = useState('Goethe A1')
  const [prompt, setPrompt] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)

  const examInfo = EXAM_LANGUAGES[examType]

  const generatePrompt = async (type) => {
    const info = EXAM_LANGUAGES[type]
    setGeneratingPrompt(true)
    setPrompt('')
    try {
      const { data } = await api.post('/writing/generate-prompt', {
        exam_type: type,
        language: info.lang,
        level: info.level,
        word_count: info.words
      })
      setPrompt(data.prompt)
    } catch {
      setPrompt(`Write a ${info.words}-word essay in ${info.lang} at ${info.level} level about a topic of your choice.`)
    } finally {
      setGeneratingPrompt(false)
    }
  }

  const handleExamChange = (e) => {
    const val = e.target.value
    setExamType(val)
    setResult(null)
    setText('')
    setPrompt('')
    generatePrompt(val)
  }

  const { mutate: submitWriting, isPending } = useMutation({
    mutationFn: () => api.post('/writing/submit', {
      text, prompt, exam_type: examType,
      language: examInfo.lang,
      cefr_level: examInfo.level
    }),
    onSuccess: ({ data }) => setResult(data),
    onError: (err) => alert(err.response?.data?.detail || 'Something went wrong.')
  })

  const ScoreCard = ({ title, data, color }) => (
    <div className={`bg-white rounded-xl border-2 ${color} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <span className="text-2xl font-bold text-gray-900">{data.score}<span className="text-sm text-gray-400">/10</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mb-3">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${data.score * 10}%` }} />
      </div>
      <p className="text-xs text-gray-600">{data.feedback}</p>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Writing Evaluator</h2>
        <p className="text-gray-500 mt-1">AI-generated exam prompts with official rubric scoring</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Exam Type</label>
              <select value={examType} onChange={handleExamChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Writing Prompt
                  <span className="ml-2 text-xs text-blue-600 font-normal">~{examInfo.words} words required</span>
                </label>
                <button onClick={() => generatePrompt(examType)} disabled={generatingPrompt}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
                  <RefreshCw size={12} className={generatingPrompt ? 'animate-spin' : ''} />
                  {generatingPrompt ? 'Generating...' : 'New Prompt'}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-3 text-sm text-gray-700 min-h-[60px]">
                {generatingPrompt ? (
                  <span className="text-gray-400 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Generating exam prompt...
                  </span>
                ) : prompt ? prompt : (
                  <span className="text-gray-400">Select an exam type to get a prompt</span>
                )}
              </div>
            </div>

            {!prompt && !generatingPrompt && (
              <button onClick={() => generatePrompt(examType)}
                className="w-full mb-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-blue-200">
                <RefreshCw size={16} />
                Generate Exam Prompt
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Response
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({text.split(/\s+/).filter(Boolean).length} / ~{examInfo.words} words)
                </span>
              </label>
              <textarea value={text} onChange={e => setText(e.target.value)}
                className="w-full h-48 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={prompt ? `Write your ${examInfo.words}-word response in ${examInfo.lang}...` : 'Generate a prompt first...'} />
            </div>

            <button onClick={() => submitWriting()}
              disabled={isPending || !text.trim() || !prompt}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
              {isPending ? <><Loader2 size={16} className="animate-spin" /> Evaluating...</> : <><FileText size={16} /> Evaluate Writing</>}
            </button>
          </div>
        </div>

        <div>
          {isPending && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Evaluating your writing...</p>
              <p className="text-gray-400 text-sm mt-1">This takes 10–15 seconds</p>
            </div>
          )}

          {result && !isPending && (
            <div className="space-y-4">
              <div className="bg-blue-600 rounded-2xl p-5 text-white text-center">
                <p className="text-sm font-medium opacity-80 mb-1">Overall Band Score</p>
                <p className="text-5xl font-bold">{result.overall_band.toFixed(1)}</p>
                <p className="text-sm opacity-70 mt-1">out of 10.0</p>
              </div>
              <ScoreCard title="Task Achievement" data={result.task_achievement} color="border-green-200" />
              <ScoreCard title="Grammatical Range & Accuracy" data={result.grammar} color="border-blue-200" />
              <ScoreCard title="Lexical Resource" data={result.vocabulary} color="border-purple-200" />
              <ScoreCard title="Coherence & Cohesion" data={result.coherence} color="border-orange-200" />
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">📝 Model Answer</h4>
                <p className="text-sm text-gray-600 whitespace-pre-line">{result.model_answer}</p>
              </div>
              <button onClick={() => generatePrompt(examType)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors">
                Try Another Prompt
              </button>
            </div>
          )}

          {!result && !isPending && (
            <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-8 text-center">
              <FileText size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">Your evaluation results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}