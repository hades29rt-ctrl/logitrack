import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

const ROLES = [
  { val: 'operateur',   label: 'Operateur',   desc: 'Reception, stockage, expedition', color: 'bg-blue-100 text-blue-700' },
  { val: 'superviseur', label: 'Superviseur', desc: 'Toutes operations + rapports',     color: 'bg-amber-100 text-amber-700' },
  { val: 'admin',       label: 'Admin',       desc: 'Acces complet + gestion users',    color: 'bg-purple-100 text-purple-700' },
]

export default function GestionUtilisateurs() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'liste' | 'creer' | 'modifier' | 'password' | 'historique'>('liste')
  const [selected, setSelected] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error'>('ok')
  const [loading, setLoading] = useState(false)
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10))
  const [dateFin, setDateFin] = useState(new Date().toISOString().slice(0, 10))

  const [form, setForm] = useState({
    login: '', nom: '', prenom: '', email: '',
    password: '', password2: '', role: 'operateur', actif: true
  })
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')

  const { data: utilisateurs, refetch } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => client.get('/utilisateurs/').then(r => r.data)
  })

  const { data: historique } = useQuery({
    queryKey: ['historique-flashage', selected?.id, dateDebut, dateFin],
    queryFn: () => client.get(
      `/utilisateurs/${selected?.id}/historique?date_debut=${dateDebut}&date_fin=${dateFin}`
    ).then(r => r.data),
    enabled: mode === 'historique' && !!selected
  })

  const handleChange = (e: any) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [e.target.name]: val })
  }

  const openCreer = () => {
    setForm({ login: '', nom: '', prenom: '', email: '', password: '', password2: '', role: 'operateur', actif: true })
    setMode('creer')
    setMessage('')
  }

  const openModifier = (u: any) => {
    setSelected(u)
    setForm({ login: u.login, nom: u.nom, prenom: u.prenom ?? '', email: u.email ?? '', password: '', password2: '', role: u.role, actif: u.actif })
    setMode('modifier')
    setMessage('')
  }

  const openPassword = (u: any) => {
    setSelected(u)
    setNewPassword('')
    setNewPassword2('')
    setMode('password')
    setMessage('')
  }

  const openHistorique = (u: any) => {
    setSelected(u)
    setMode('historique')
    setMessage('')
  }

  const handleSubmit = async () => {
    if (!form.login || !form.nom) {
      setMessage('Login et nom sont obligatoires')
      setMessageType('error')
      return
    }
    if (mode === 'creer') {
      if (!form.password) { setMessage('Mot de passe obligatoire'); setMessageType('error'); return }
      if (form.password !== form.password2) { setMessage('Les mots de passe ne correspondent pas'); setMessageType('error'); return }
      if (form.password.length < 2 || form.password.length > 5) {
        setMessage('Mot de passe doit faire entre 2 et 5 caracteres')
        setMessageType('error')
        return
      }
    }

    setLoading(true)
    try {
      let res
      if (mode === 'creer') {
        res = await client.post('/utilisateurs/', {
          login: form.login, nom: form.nom, prenom: form.prenom,
          email: form.email, password: form.password, role: form.role
        })
      } else {
        res = await client.put(`/utilisateurs/${selected.id}`, {
          nom: form.nom, prenom: form.prenom, email: form.email,
          role: form.role, actif: form.actif
        })
      }

      if (res.data.error) {
        setMessage(res.data.error)
        setMessageType('error')
      } else {
        setMessage(mode === 'creer' ? 'Utilisateur cree avec succes !' : 'Utilisateur mis a jour !')
        setMessageType('ok')
        queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
        refetch()
        setTimeout(() => setMode('liste'), 1500)
      }
    } catch {
      setMessage('Erreur lors de la sauvegarde')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!newPassword) { setMessage('Nouveau mot de passe obligatoire'); setMessageType('error'); return }
    if (newPassword !== newPassword2) { setMessage('Les mots de passe ne correspondent pas'); setMessageType('error'); return }
    if (newPassword.length < 2 || newPassword.length > 5) {
      setMessage('Mot de passe doit faire entre 2 et 5 caracteres')
      setMessageType('error')
      return
    }

    setLoading(true)
    try {
      const res = await client.put(`/utilisateurs/${selected.id}/password`, {
        nouveau_password: newPassword
      })
      if (res.data.error) {
        setMessage(res.data.error)
        setMessageType('error')
      } else {
        setMessage('Mot de passe mis a jour !')
        setMessageType('ok')
        setTimeout(() => setMode('liste'), 1500)
      }
    } catch {
      setMessage('Erreur lors du changement')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleSupprimer = async (id: number, login: string, role: string) => {
    if (role === 'admin' || role === 'superviseur') {
      alert('Impossible de supprimer un admin ou superviseur')
      return
    }
    if (!confirm(`Supprimer definitivement le compte ${login} ?\nCette action est irreversible.`)) return
    const res = await client.delete(`/utilisateurs/${id}`)
    if (res.data.error) {
      alert(res.data.error)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
    refetch()
  }

  const roleInfo = (role: string) => ROLES.find(r => r.val === role)
  const msgColor = (type: string) => type === 'ok'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-red-50 border-red-200 text-red-700'

  const typeScanColor: Record<string, string> = {
    reception:  'bg-green-100 text-green-700',
    stockage:   'bg-blue-100 text-blue-700',
    expedition: 'bg-amber-100 text-amber-700',
    transfert:  'bg-purple-100 text-purple-700',
  }

  if (mode === 'historique') {
    const totalScans = historique?.length ?? 0
    const parType: Record<string, number> = {}
    historique?.forEach((h: any) => {
      parType[h.type_scan] = (parType[h.type_scan] ?? 0) + 1
    })

    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('liste')} className="text-slate-500 hover:text-slate-700 text-sm">← Retour</button>
          <h1 className="text-xl font-medium text-slate-800">
            Historique flashage — {selected?.prenom} {selected?.nom}
          </h1>
          <span className="text-xs text-slate-500 font-mono">{selected?.login}</span>
        </div>

        <div className="flex gap-3 mb-4 items-end flex-wrap">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Du</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Au</label>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm" />
          </div>
          <button
            onClick={() => {
              setDateDebut(new Date().toISOString().slice(0, 10))
              setDateFin(new Date().toISOString().slice(0, 10))
            }}
            className="px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50"
          >
            Aujourd'hui
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
            <div className="text-2xl font-medium text-slate-800">{totalScans}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Total scans</div>
          </div>
          {Object.entries(parType).map(([type, nb]) => (
            <div key={type} className="bg-white rounded-lg border border-slate-200 p-3 text-center">
              <div className="text-2xl font-medium text-slate-800">{nb}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">{type}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Detail des scans</h2>
            <span className="text-xs text-slate-500">{totalScans} enregistrement(s)</span>
          </div>

          {totalScans === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucun scan sur cette periode</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Date / Heure</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Type</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Article</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Emplacement</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Code scan</th>
                </tr>
              </thead>
              <tbody>
                {historique?.map((h: any) => (
                  <tr key={h.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-2 text-xs text-slate-600">
                      {new Date(h.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeScanColor[h.type_scan] ?? 'bg-slate-100 text-slate-600'}`}>
                        {h.type_scan}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs">{h.reference_article || '—'}</td>
                    <td className="p-2 font-mono text-xs">{h.emplacement || '—'}</td>
                    <td className="p-2 font-mono text-xs text-slate-400 max-w-xs truncate">{h.code_scan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'password') {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('liste')} className="text-slate-500 hover:text-slate-700 text-sm">← Retour</button>
          <h1 className="text-xl font-medium text-slate-800">Changer mot de passe — {selected?.login}</h1>
        </div>
        {message && <div className={`p-3 rounded-lg border mb-4 text-sm ${msgColor(messageType)}`}>{message}</div>}
        <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-md">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 mb-4">
            Mot de passe : entre 2 et 5 caracteres
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Nouveau mot de passe</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="2 a 5 caracteres" maxLength={5}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Confirmer mot de passe</label>
              <input type="password" value={newPassword2} onChange={e => setNewPassword2(e.target.value)}
                placeholder="Repetez" maxLength={5}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            <button onClick={handlePasswordChange} disabled={loading}
              className="flex-1 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40 font-medium">
              {loading ? 'Sauvegarde...' : 'Changer mot de passe'}
            </button>
            <button onClick={() => setMode('liste')}
              className="px-4 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50">Annuler</button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'creer' || mode === 'modifier') {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('liste')} className="text-slate-500 hover:text-slate-700 text-sm">← Retour</button>
          <h1 className="text-xl font-medium text-slate-800">
            {mode === 'creer' ? 'Nouvel utilisateur' : `Modifier — ${selected?.login}`}
          </h1>
        </div>
        {message && <div className={`p-3 rounded-lg border mb-4 text-sm ${msgColor(messageType)}`}>{message}</div>}

        <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-2xl">
          {mode === 'creer' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 mb-4">
              Mot de passe operateur : entre 2 et 5 caracteres (ex: 1234, AB12)
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Login *</label>
              <input name="login" value={form.login} onChange={handleChange}
                disabled={mode === 'modifier'} placeholder="prenom.nom"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm disabled:bg-slate-50" />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Role *</label>
              <select name="role" value={form.role} onChange={handleChange}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                {ROLES.map(r => (
                  <option key={r.val} value={r.val}>{r.label} — {r.desc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} placeholder="Nom de famille"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Prenom</label>
              <input name="prenom" value={form.prenom} onChange={handleChange} placeholder="Prenom"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium block mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="prenom.nom@entreprise.fr"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>

            {mode === 'creer' && (
              <>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Mot de passe * (2-5 car.)</label>
                  <input type="password" name="password" value={form.password} onChange={handleChange}
                    placeholder="2 a 5 caracteres" maxLength={5}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Confirmer *</label>
                  <input type="password" name="password2" value={form.password2} onChange={handleChange}
                    placeholder="Repetez" maxLength={5}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                </div>
              </>
            )}

            {mode === 'modifier' && (
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" name="actif" id="actif" checked={form.actif} onChange={handleChange} className="rounded" />
                <label htmlFor="actif" className="text-sm text-slate-600">Compte actif</label>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40 font-medium">
              {loading ? 'Sauvegarde...' : mode === 'creer' ? 'Creer utilisateur' : 'Enregistrer'}
            </button>
            <button onClick={() => setMode('liste')}
              className="px-4 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50">Annuler</button>
          </div>
        </div>
      </div>
    )
  }

  const byRole = (role: string) => utilisateurs?.filter((u: any) => u.role === role) ?? []

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-slate-800">Gestion des utilisateurs</h1>
        <p className="text-sm text-slate-500">Comptes operateurs, superviseurs et administrateurs</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {ROLES.map(r => (
          <div key={r.val} className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>{r.label}</span>
              <span className="text-xl font-medium text-slate-800">{byRole(r.val).length}</span>
            </div>
            <div className="text-xs text-slate-500">{r.desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex justify-end mb-4">
          <button onClick={openCreer}
            className="px-4 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 font-medium">
            + Nouvel utilisateur
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Login</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Nom</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Email</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Role</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Derniere connexion</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Statut</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs?.map((u: any) => {
              const role = roleInfo(u.role)
              const peutSupprimer = u.role === 'operateur'
              const peutHistorique = u.role === 'operateur'
              return (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs font-medium">{u.login}</td>
                  <td className="p-2">{u.nom} {u.prenom}</td>
                  <td className="p-2 text-xs text-slate-500">{u.email ?? '—'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${role?.color ?? ''}`}>
                      {role?.label ?? u.role}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-slate-500">
                    {u.derniere_connexion
                      ? new Date(u.derniere_connexion).toLocaleString('fr-FR')
                      : 'Jamais connecte'}
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => openModifier(u)}
                        className="px-2 py-1 border border-slate-200 rounded text-xs hover:bg-slate-100">
                        Modifier
                      </button>
                      <button onClick={() => openPassword(u)}
                        className="px-2 py-1 border border-blue-200 text-blue-600 rounded text-xs hover:bg-blue-50">
                        MDP
                      </button>
                      {peutHistorique && (
                        <button onClick={() => openHistorique(u)}
                          className="px-2 py-1 border border-green-200 text-green-600 rounded text-xs hover:bg-green-50">
                          Historique
                        </button>
                      )}
                      {peutSupprimer && (
                        <button onClick={() => handleSupprimer(u.id, u.login, u.role)}
                          className="px-2 py-1 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
