import { useState, useEffect } from 'react'

export interface User {
  id: number
  login: string
  nom: string
  prenom: string
  role: 'operateur' | 'superviseur' | 'admin'
  token?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('logitrack_user')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.id) {
          setUser(parsed)
        }
      }
    } catch {
      localStorage.removeItem('logitrack_user')
    }
    setLoading(false)
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem('logitrack_user', JSON.stringify(userData))
    if (userData.token) {
      localStorage.setItem('logitrack_token', userData.token)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('logitrack_user')
    localStorage.removeItem('logitrack_token')
  }

  const getToken = (): string | null => {
    return localStorage.getItem('logitrack_token')
  }

  const isAdmin       = user?.role === 'admin'
  const isSuperviseur = user?.role === 'superviseur' || user?.role === 'admin'
  const isOperateur   = !!user

  const peutAcceder = (page: string): boolean => {
    if (!user) return false
    const tousPages = [
      'dashboard', 'reception', 'stockage', 'expedition',
      'etiquettes', 'entree-stock', 'sortie-stock', 'articles', 'historique'
    ]
    if (tousPages.includes(page)) return true
    const superviseurPages = ['fournisseurs', 'gestion-articles', 'gestion-fournisseurs', 'gestion-clients']
    if (superviseurPages.includes(page)) return isSuperviseur
    const adminPages = ['gestion-utilisateurs']
    if (adminPages.includes(page)) return isAdmin
    return false
  }

  return { user, loading, login, logout, getToken, isAdmin, isSuperviseur, isOperateur, peutAcceder }
}
