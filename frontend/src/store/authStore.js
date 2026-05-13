import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('linguaai_user') || 'null'),
  token: localStorage.getItem('linguaai_token') || null,
  isAuthenticated: !!localStorage.getItem('linguaai_token'),

  login: (userData) => {
    localStorage.setItem('linguaai_token', userData.token)
    localStorage.setItem('linguaai_user', JSON.stringify(userData))
    set({ user: userData, token: userData.token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('linguaai_token')
    localStorage.removeItem('linguaai_user')
    set({ user: null, token: null, isAuthenticated: false })
  }
}))

export default useAuthStore