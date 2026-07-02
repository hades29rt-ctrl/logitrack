import { useState } from 'react'

interface User {
  id: number
  login: string
  nom: string
  prenom: string
  role: string
}

interface Props {
  activePage: string
  onNavigate: (page: string) => void
  user: User | null
  onLogin: (userData: User) => void
  onLogout: () => void
}

const API = 'http://localhost:8000'

const roleColor: Record<string, string> = {
  operateur:   'bg-blue-500',
  superviseur: 'bg-amber-500',
  admin:       'bg-purple-500',
}

const roleLabel: Record<string, string> = {
  operateur:   'Operateur',
  superviseur: 'Superviseur',
  admin:       'Admin',
}

export default function Sidebar({ activePage, onNavigate, user, onLogin, onLogout }: Props) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)
  const [aprovOpen, setAprovOpen] = useState(true)
  const [gestionOpen, setGestionOpen] = useState(false)

  if (!user) {
    const isAdmin = false
    const isSuperviseur = false
    void isAdmin
    void isSuperviseur
  }

  const isAdmin       = user?.role === 'admin'
  const isSuperviseur = user?.role === 'superviseur' || user?.role === 'admin'

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!login || !password) { setErreur('Login et mot de passe requis'); return }
    setLoading(true)
    setErreur('')
    try {
      const res = await fetch(`${API}/utilisateurs/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      })
      const data = await res.json()
      if (data.success) {
        onLogin(data)
        setLogin('')
        setPassword('')
      } else {
        setErreur(data.error ?? 'Connexion refusee')
      }
    } catch {
      setErreur('Serveur inaccessible')
    } finally {
      setLoading(false)
    }
  }

  const item = (label: string, page: string, icon: string, disabled = false) => (
    <div
      key={page}
      onClick={() => !disabled && onNavigate(page)}
      className={`flex items-center gap-2 px-4 py-2 text-sm border-l-2 transition-all
        ${disabled
          ? 'opacity-30 cursor-not-allowed text-slate-600 border-transparent'
          : activePage === page
            ? 'bg-slate-700 text-white border-amber-400 cursor-pointer'
            : 'text-slate-400 border-transparent hover:bg-slate-700 hover:text-white cursor-pointer'
        }`}
    >
      <span className="text-sm w-4 text-center flex-shrink-0">{icon}</span>
      {label}
    </div>
  )

  return (
    <div className="w-52 bg-slate-900 text-slate-200 flex flex-col min-h-screen flex-shrink-0">

      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-700">
        <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
          📦
        </div>
        <div>
          <div className="text-sm font-medium text-slate-100">LogiTrack Pro</div>
          <div className="text-xs text-slate-500">WMS v2.0</div>
        </div>
      </div>

      {!user ? (
        <div className="p-3 border-b border-slate-700">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Connexion</div>
          {erreur && (
            <div className="text-xs text-red-400 mb-2 bg-red-900 bg-opacity-30 rounded p-1.5">
              {erreur}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-2">
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="Login"
              autoComplete="username"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              maxLength={5}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold rounded px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      ) : (
        <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${roleColor[user.role] ?? 'bg-slate-500'}`}></div>
            <div>
              <div className="text-xs text-slate-200 font-medium">{user.prenom} {user.nom}</div>
              <div className="text-xs text-slate-500">{roleLabel[user.role] ?? user.role}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            title="Deconnexion"
          >
            ✕
          </button>
        </div>
      )}

      {user ? (
        <div className="flex-1 py-2 overflow-y-auto">

          <div className="px-3 pt-3 pb-1 text-xs text-slate-500 uppercase tracking-widest">Principal</div>
          {item('Tableau de bord', 'dashboard', '⊞')}

          <div className="px-3 pt-3 pb-1 text-xs text-slate-500 uppercase tracking-widest">Operations</div>
          {item('Reception',      'reception',  '↓')}
          {item('Stockage',       'stockage',   '▣')}
          {item('Expedition',     'expedition', '↑')}
          {item('Etiquettes EAN', 'etiquettes', '▪')}

          <div className="px-3 pt-3 pb-1 text-xs text-slate-500 uppercase tracking-widest">Approvisionnement</div>
          <div
            onClick={() => setAprovOpen(!aprovOpen)}
            className="flex items-center justify-between px-4 py-2 cursor-pointer text-sm text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <span>⟳ Approvisionnement</span>
            <span className="text-xs">{aprovOpen ? '▾' : '▸'}</span>
          </div>
          {aprovOpen && (
            <div className="bg-slate-950">
              {item('Entree en stock', 'entree-stock', '+')}
              {item('Sortie de stock', 'sortie-stock', '−')}
            </div>
          )}

          <div className="px-3 pt-3 pb-1 text-xs text-slate-500 uppercase tracking-widest">Consultation</div>
          {item('Articles',     'articles',     '≡')}
          {item('Fournisseurs', 'fournisseurs', '○', !isSuperviseur)}
          {item('Historique',   'historique',   '⏱')}
          {item('Clients',      'gestion-clients', '👤', !isSuperviseur)}
          {isSuperviseur && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs text-slate-500 uppercase tracking-widest">Gestion</div>
              <div
                onClick={() => setGestionOpen(!gestionOpen)}
                className="flex items-center justify-between px-4 py-2 cursor-pointer text-sm text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                <span>⚙ Administration</span>
                <span className="text-xs">{gestionOpen ? '▾' : '▸'}</span>
              </div>
              {gestionOpen && (
                <div className="bg-slate-950">
                  {item('Gestion articles',     'gestion-articles',     '✎')}
                  {item('Gestion fournisseurs', 'gestion-fournisseurs', '✎')}
                  {isAdmin && item('Gestion utilisateurs', 'gestion-utilisateurs', '👤')}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="text-3xl mb-3">🔒</div>
            <p className="text-xs text-slate-500">Connectez-vous pour acceder a l'application</p>
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-t border-slate-700">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          <span className="text-xs text-slate-500">Systeme operationnel</span>
        </div>
      </div>

    </div>
  )
}
