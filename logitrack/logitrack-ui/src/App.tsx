import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Reception from './pages/Reception'
import Stockage from './pages/Stockage'
import Articles from './pages/Articles'
import EntreeStock from './pages/EntreeStock'
import SortieStock from './pages/SortieStock'
import GestionArticles from './pages/GestionArticles'
import GestionFournisseurs from './pages/GestionFournisseurs'
import GestionUtilisateurs from './pages/GestionUtilisateurs'
import { useAuth } from './hooks/useAuth'

function App() {
  const { user, login, logout } = useAuth()
  const [page, setPage] = useState('dashboard')

  const isAdmin       = user?.role === 'admin'
  const isSuperviseur = user?.role === 'superviseur' || user?.role === 'admin'

  const peutAcceder = (p: string): boolean => {
    if (!user) return false
    const tousPages = [
      'dashboard', 'reception', 'stockage', 'expedition',
      'etiquettes', 'entree-stock', 'sortie-stock', 'articles', 'historique'
    ]
    if (tousPages.includes(p)) return true
    const superviseurPages = ['fournisseurs', 'gestion-articles', 'gestion-fournisseurs']
    if (superviseurPages.includes(p)) return isSuperviseur
    const adminPages = ['gestion-utilisateurs']
    if (adminPages.includes(p)) return isAdmin
    return false
  }

  const navigate = (p: string) => {
    if (peutAcceder(p)) setPage(p)
  }

  const renderPage = () => {
    if (!user) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <div className="text-6xl mb-4">📦</div>
            <h1 className="text-2xl font-medium text-slate-700 mb-2">LogiTrack Pro</h1>
            <p className="text-slate-400 text-sm">Connectez-vous dans la barre de gauche</p>
          </div>
        </div>
      )
    }

    if (!peutAcceder(page)) {
      return (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-red-700 font-medium mb-2">Acces refuse</h2>
            <p className="text-red-600 text-sm">Vous n'avez pas les droits pour cette page.</p>
          </div>
        </div>
      )
    }

    switch (page) {
      case 'dashboard':            return <Dashboard />
      case 'reception':            return <Reception />
      case 'stockage':             return <Stockage />
      case 'articles':             return <Articles />
      case 'entree-stock':         return <EntreeStock />
      case 'sortie-stock':         return <SortieStock />
      case 'gestion-articles':     return <GestionArticles />
      case 'gestion-fournisseurs': return <GestionFournisseurs />
      case 'gestion-utilisateurs': return <GestionUtilisateurs />
      default: return (
        <div className="p-6">
          <h1 className="text-xl font-medium text-slate-800 mb-2">
            {page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g, ' ')}
          </h1>
          <p className="text-slate-500 text-sm">Cette page est en cours de developpement.</p>
        </div>
      )
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activePage={page}
        onNavigate={navigate}
        user={user}
        onLogin={login}
        onLogout={logout}
      />
      <main className="flex-1 bg-slate-50 overflow-auto">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
