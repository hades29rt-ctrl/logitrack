import { useState, useEffect } from 'react'

export interface User {
  id: number
  login: string
  nom: string
  prenom: string
  role: 'operateur' | 'superviseur' | 'admin'
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('logitrack_user')
    console.log('useAuth stored:', stored)
    if (stored && stored !== 'null' && stored !== 'undefined') {
      try {
        const parsed = JSON.parse(stored)
        console.log('useAuth parsed:', parsed)
        if (parsed && parsed.id && parsed.login) {
          setUser(parsed)
        }
      } catch {
        localStorage.removeItem('logitrack_user')
      }
    }
    setLoading(false)
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem('logitrack_user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('logitrack_user')
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
    const superviseurPages = ['fournisseurs', 'gestion-articles', 'gestion-fournisseurs']
    if (superviseurPages.includes(page)) return isSuperviseur
    const adminPages = ['gestion-utilisateurs']
    if (adminPages.includes(page)) return isAdmin
    return false
  }

  return { user, loading, login, logout, isAdmin, isSuperviseur, isOperateur, peutAcceder }
}
