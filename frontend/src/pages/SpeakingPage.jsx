import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Mic, Square, Loader2, Volume2 } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const PERSONAS = [
  'Free Practice',
  // German - Goethe
  'Goethe A1 Oral Examiner',
  'Goethe A2 Oral Examiner',
  'Goethe B1 Oral Examiner',
  'Goethe B2 Oral Examiner',
  'Goethe C1 Oral Examiner',
  'Goethe C2 Oral Examiner',
  // French - DELF
  'DELF A1 Oral Examiner',
  'DELF A2 Oral Examiner',
  'DELF B1 Oral Examiner',
  'DELF B2 Oral Examiner',
  'DALF C1 Oral Examiner',
  'DALF C2 Oral Examiner',
  // Spanish - DELE
  'DELE A1 Oral Examiner',
  'DELE A2 Oral Examiner',
  'DELE B1 Oral Examiner',
  'DELE B2 Oral Examiner',
  'DELE C1 Oral Examiner',
  // Japanese - JLPT
  'JLPT N5 Speaking Practice',
  'JLPT N4 Speaking Practice',
  'JLPT N3 Speaking Practice',
  'JLPT N2 Speaking Practice',
  // Chinese - HSK
  'HSK 3 Speaking Practice',
  'HSK 4 Speaking Practice',
  'HSK 5 Speaking Practice',
  'HSK 6 Speaking Practice',
  // Italian - CELI
  'CELI A2 Oral Examiner',
  'CELI B1 Oral Examiner',
  'CELI B2 Oral Examiner',
  'CELI C1 Oral Examiner',
  // General
  'Friendly Conversation Partner',
  'Job Interview Partner',
  'Travel Conversation Partner',
]
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function SpeakingPage() {
  const user = useAuthStore(s => s.user)
  const [persona, setPersona] = useState('Free Practice')
  const [level, setLevel] = useState(user?.cefr_level || 'B1')
  const [isRecording, setIsRecording] = useState(false)
  const [conversation, setConversation] = useState([])
  const [sessionActive, setSessionActive] = useState(false)
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const chatEndRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conversation])

  const { mutate: sendAudio, isPending: sending } = useMutation({
    mutationFn: async (audioBlob) => {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('language', user?.target_language || 'German')
      formData.append('level', level)
      formData.append('persona', persona)
      formData.append('conversation_history', JSON.stringify(conversation.map(t => ({ user: t.user, assistant: t.assistant }))))
      const { data } = await api.post('/speaking/reply', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      return data
    },
    onSuccess: (data) => {
      setConversation(prev => [...prev, { user: data.transcript, assistant: data.ai_response_text }])
      setStatus('')
      if (data.audio_base64) {
        const bytes = new Uint8Array(data.audio_base64.match(/.{1,2}/g).map(b => parseInt(b, 16)))
        const blob = new Blob([bytes], { type: 'audio/mpeg' })
        new Audio(URL.createObjectURL(blob)).play()
      }
    },
    onError: (err) => setStatus('Error: ' + (err.response?.data?.detail || 'Something went wrong'))
  })

  const { mutate: getReport, isPending: gettingReport } = useMutation({
    mutationFn: () => api.post('/speaking/report', {
      transcript: conversation.map(t => t.user).join(' '),
      language: user?.target_language || 'German', level, persona,
      duration_seconds: startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0
    }),
    onSuccess: ({ data }) => setReport(data),
    onError: (err) => alert(err.response?.data?.detail || 'Could not generate report.')
  })

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setStatus('Transcribing...')
        sendAudio(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorder.start()
      setIsRecording(true)
      if (!sessionActive) { setSessionActive(true); startTimeRef.current = Date.now() }
    } catch { alert('Could not access microphone. Please allow microphone access.') }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false) }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">AI Speaking Partner</h2>
        <p className="text-gray-500 mt-1">Practice speaking {user?.target_language} with your AI tutor</p>
      </div>

      {!sessionActive && !report && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Practice Mode</label>
              <select value={persona} onChange={e => setPersona(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {PERSONAS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Level</label>
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${level === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={startRecording}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
            <Mic size={18} /> Start Speaking Session
          </button>
        </div>
      )}

      {sessionActive && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
            <Volume2 size={16} className="text-blue-600" />
            <span className="text-sm text-blue-700 font-medium">{persona}</span>
          </div>
          <div className="h-96 overflow-y-auto p-4 space-y-3">
            {conversation.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-8">Press the microphone and start speaking in {user?.target_language}</p>
            )}
            {conversation.map((turn, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white rounded-xl rounded-tr-sm px-4 py-2 max-w-xs text-sm">{turn.user}</div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 rounded-xl rounded-tl-sm px-4 py-2 max-w-xs text-sm">{turn.assistant}</div>
                </div>
              </div>
            ))}
            {(sending || status) && (
              <div className="flex justify-center">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" />{status || 'AI is thinking...'}
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-center gap-4">
            <button onClick={isRecording ? stopRecording : startRecording} disabled={sending}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg
                ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-60'}`}>
              {isRecording ? <Square size={20} className="text-white" fill="white" /> : <Mic size={24} className="text-white" />}
            </button>
            <button onClick={() => { if (conversation.length > 0) getReport(); setSessionActive(false) }}
              className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium">
              End Session & Get Report
            </button>
          </div>
        </div>
      )}

      {gettingReport && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Generating your fluency report...</p>
        </div>
      )}

      {report && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg">Fluency Report</h3>
            <span className="text-3xl font-bold text-blue-600">{report.band_score.toFixed(1)}<span className="text-base text-gray-400">/10</span></span>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm text-gray-700">{report.overall_comment}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Vocabulary Feedback</h4>
              <p className="text-sm text-gray-600">{report.vocabulary_feedback}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Pronunciation Notes</h4>
              <p className="text-sm text-gray-600">{report.pronunciation_notes}</p>
            </div>
          </div>
          {report.grammar_mistakes?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Grammar to Work On</h4>
              <ul className="space-y-1">
                {report.grammar_mistakes.map((m, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-orange-500 mt-0.5">•</span>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => { setReport(null); setConversation([]); setSessionActive(false) }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors">
            Start New Session
          </button>
        </div>
      )}
    </div>
  )
}