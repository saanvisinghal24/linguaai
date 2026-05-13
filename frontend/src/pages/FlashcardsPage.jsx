import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Brain } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const LANGUAGES = ['German', 'French', 'Spanish', 'Japanese', 'Chinese', 'Italian']

export default function FlashcardsPage() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [view, setView] = useState('decks')
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [newDeck, setNewDeck] = useState({ title: '', language: user?.target_language || 'German' })
  const [newCard, setNewCard] = useState({ front: '', back: '' })
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [showAddDeck, setShowAddDeck] = useState(false)

  const { data: decks, isLoading: loadingDecks } = useQuery({
    queryKey: ['decks'],
    queryFn: () => api.get('/flashcards/decks').then(r => r.data)
  })

  const { data: dueCards, isLoading: loadingDue } = useQuery({
    queryKey: ['due-cards'],
    queryFn: () => api.get('/flashcards/due').then(r => r.data),
    enabled: view === 'review'
  })

  const { mutate: createDeck, isPending: creatingDeck } = useMutation({
    mutationFn: () => api.post('/flashcards/decks', { title: newDeck.title, language: newDeck.language, description: '' }),
    onSuccess: () => { queryClient.invalidateQueries(['decks']); setNewDeck({ title: '', language: user?.target_language || 'German' }); setShowAddDeck(false) }
  })

  const { mutate: addCard, isPending: addingCard } = useMutation({
    mutationFn: () => api.post('/flashcards/cards', { deck_id: selectedDeck?.id, front_text: newCard.front, back_text: newCard.back }),
    onSuccess: (res) => { queryClient.invalidateQueries(['decks']); alert(`Card added! Example: "${res.data.example_sentence}"`); setNewCard({ front: '', back: '' }) }
  })

  const { mutate: reviewCard } = useMutation({
    mutationFn: ({ card_id, rating }) => api.post('/flashcards/review', { card_id, rating }),
    onSuccess: () => {
      setFlipped(false)
      if (currentCardIndex < (dueCards?.length || 0) - 1) {
        setCurrentCardIndex(i => i + 1)
      } else {
        queryClient.invalidateQueries(['due-cards'])
        setCurrentCardIndex(0)
        alert('🎉 All done for today!')
        setView('decks')
      }
    }
  })

  const currentCard = dueCards?.[currentCardIndex]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Flashcards</h2>
          <p className="text-gray-500 mt-1">Spaced repetition powered by SM-2 algorithm</p>
        </div>
        <div className="flex gap-2">
          {['decks', 'review'].map(v => (
            <button key={v} onClick={() => { setView(v); setCurrentCardIndex(0) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {v === 'decks' ? 'My Decks' : 'Review Today'}
            </button>
          ))}
        </div>
      </div>

      {view === 'decks' && (
        <div className="space-y-4">
          {loadingDecks ? <p className="text-gray-400">Loading decks...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {decks?.map(deck => (
                <div key={deck.id} onClick={() => { setSelectedDeck(deck); setView('add-card') }}
                  className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Brain size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{deck.title}</p>
                      <p className="text-xs text-gray-500">{deck.language}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{deck.card_count} <span className="text-sm text-gray-400 font-normal">cards</span></p>
                </div>
              ))}
              <button onClick={() => setShowAddDeck(true)}
                className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-5 hover:border-blue-300 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 min-h-[120px]">
                <Plus size={24} className="text-gray-400" />
                <span className="text-sm text-gray-500 font-medium">New Deck</span>
              </button>
            </div>
          )}

          {showAddDeck && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <h3 className="font-bold text-gray-800 mb-4">Create New Deck</h3>
                <input value={newDeck.title} onChange={e => setNewDeck({ ...newDeck, title: e.target.value })}
                  placeholder="Deck name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={newDeck.language} onChange={e => setNewDeck({ ...newDeck, language: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddDeck(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium">Cancel</button>
                  <button onClick={() => createDeck()} disabled={!newDeck.title || creatingDeck}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                    {creatingDeck ? 'Creating...' : 'Create Deck'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'add-card' && selectedDeck && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setView('decks')} className="text-blue-600 text-sm hover:underline">← Decks</button>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium text-gray-700">{selectedDeck.title}</span>
          </div>
          <h3 className="font-semibold text-gray-800 mb-4">Add a Card</h3>
          <input value={newCard.front} onChange={e => setNewCard({ ...newCard, front: e.target.value })}
            placeholder="Word / phrase in target language"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={newCard.back} onChange={e => setNewCard({ ...newCard, back: e.target.value })}
            placeholder="Translation / meaning"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-xs text-gray-400 mb-3">✨ AI will auto-generate an example sentence and memory trick</p>
          <button onClick={() => addCard()} disabled={!newCard.front || !newCard.back || addingCard}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
            {addingCard ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Plus size={14} /> Add Card</>}
          </button>
        </div>
      )}

      {view === 'review' && (
        <div className="max-w-md mx-auto">
          {loadingDue && <div className="text-center text-gray-400 py-12"><Loader2 size={24} className="animate-spin mx-auto" /></div>}
          {!loadingDue && (!dueCards || dueCards.length === 0) && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-4xl mb-3">🎉</p>
              <p className="font-semibold text-gray-800">Nothing due today!</p>
              <p className="text-gray-500 text-sm mt-1">Come back tomorrow for more reviews.</p>
            </div>
          )}
          {!loadingDue && currentCard && (
            <div className="space-y-4">
              <p className="text-center text-sm text-gray-500">Card {currentCardIndex + 1} of {dueCards.length}</p>
              <div className={`flip-card h-64 cursor-pointer ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
                <div className="flip-card-inner relative w-full h-full">
                  <div className="flip-card-front absolute inset-0 bg-white rounded-2xl border-2 border-blue-200 flex flex-col items-center justify-center p-6">
                    <p className="text-2xl font-bold text-gray-900 text-center">{currentCard.front_text}</p>
                    <p className="text-xs text-gray-400 mt-4">Tap to reveal</p>
                  </div>
                  <div className="flip-card-back absolute inset-0 bg-blue-600 rounded-2xl flex flex-col items-center justify-center p-6 text-white">
                    <p className="text-2xl font-bold text-center">{currentCard.back_text}</p>
                    {currentCard.example_sentence && <p className="text-sm opacity-80 text-center mt-3 italic">{currentCard.example_sentence}</p>}
                    {currentCard.mnemonic && <p className="text-xs opacity-60 text-center mt-2">💡 {currentCard.mnemonic}</p>}
                  </div>
                </div>
              </div>
              {flipped && (
                <div className="flex gap-3">
                  {[{ label: 'Again', rating: 0, color: 'bg-red-100 text-red-700 hover:bg-red-200' },
                    { label: 'Hard', rating: 3, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
                    { label: 'Easy', rating: 5, color: 'bg-green-100 text-green-700 hover:bg-green-200' }
                  ].map(({ label, rating, color }) => (
                    <button key={label} onClick={() => reviewCard({ card_id: currentCard.id, rating })}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${color}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {!flipped && <p className="text-center text-xs text-gray-400">Tap the card to see the answer, then rate yourself</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}