import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { User, Lock, Globe, BookOpen, Save, CheckCircle } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const LANGUAGES = ['German', 'French', 'Spanish', 'Japanese', 'Chinese', 'Italian', 'Portuguese', 'Korean', 'Arabic', 'Hindi']
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function SettingsPage() {
  const { user, login } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    native_language: user?.native_language || 'English',
    target_language: user?.target_language || 'German',
    cefr_level: user?.cefr_level || 'A1',
  })

  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  const { mutate: updateProfile, isPending: savingProfile } = useMutation({
    mutationFn: () => api.put('/settings/profile', profile),
    onSuccess: ({ data }) => {
      // Update auth store with new info
      const updatedUser = { ...user, ...data }
      login({ ...updatedUser, token: user.token })
      setSaved(true)
      setError('')
      setTimeout(() => setSaved(false), 3000)
      queryClient.invalidateQueries(['progress'])
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not update profile.')
  })

  const { mutate: changePassword, isPending: savingPassword } = useMutation({
    mutationFn: () => api.put('/settings/password', {
      current_password: passwords.current_password,
      new_password: passwords.new_password
    }),
    onSuccess: () => {
      setSaved(true)
      setError('')
      setPasswords({ current_password: '', new_password: '', confirm_password: '' })
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not change password.')
  })

  const handlePasswordSubmit = () => {
    if (passwords.new_password !== passwords.confirm_password) {
      setError('New passwords do not match.')
      return
    }
    if (passwords.new_password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError('')
    changePassword()
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'language', label: 'Language & Level', icon: Globe },
    { id: 'password', label: 'Password', icon: Lock },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{user?.name}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">{user?.cefr_level}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{user?.target_language} learner</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setActiveTab(id); setError(''); setSaved(false) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${activeTab === id
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Personal Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Native Language</label>
              <select value={profile.native_language} onChange={e => setProfile({ ...profile, native_language: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['English', 'Hindi', 'Punjabi', ...LANGUAGES].filter((v, i, a) => a.indexOf(v) === i).map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Language & Level tab */}
        {activeTab === 'language' && (
          <div className="space-y-6">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Language & Level Settings</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Language (I want to learn)</label>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map(lang => (
                  <button key={lang} onClick={() => setProfile({ ...profile, target_language: lang })}
                    className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-colors border
                      ${profile.target_language === lang
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current CEFR Level</label>
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map(level => (
                  <button key={level} onClick={() => setProfile({ ...profile, cefr_level: level })}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors border
                      ${profile.cefr_level === level
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                A1-A2: Beginner · B1-B2: Intermediate · C1-C2: Advanced
              </p>
            </div>
          </div>
        )}

        {/* Password tab */}
        {activeTab === 'password' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Change Password</h3>
            {['current_password', 'new_password', 'confirm_password'].map((field, i) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {['Current Password', 'New Password', 'Confirm New Password'][i]}
                </label>
                <input type="password" value={passwords[field]}
                  onChange={e => setPasswords({ ...passwords, [field]: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••" />
              </div>
            ))}
          </div>
        )}

        {/* Error & Success messages */}
        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {saved && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <p className="text-green-600 dark:text-green-400 text-sm font-medium">Saved successfully!</p>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={activeTab === 'password' ? handlePasswordSubmit : () => updateProfile()}
          disabled={savingProfile || savingPassword}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
          <Save size={16} />
          {savingProfile || savingPassword ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}