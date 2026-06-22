import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

export default function GestionClients() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'liste' | 'creer' | 'modifier'>('liste')
  const [selected, setSelected] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error'>('ok')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    code: '', raison_sociale: '', adresse: '',
    code_postal: '', ville: '', pays: 'France',
    telephone: '', email: '', logo_url: '', actif: true
  })

  const { data: clients_list, refetch } = useQuery({
    queryKey: ['clients-gestion'],
    queryFn: () => client.get('/clients/').then(r => r.data)
  })

  const handleChange = (e: any) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [e.target.name]: val })
  }

  const openCreer = () => {
    setForm({ code: '', raison_sociale: '', adresse: '', code_postal: '', ville: '', pays: 'France', telephone: '', email: '', logo_url: '', actif: true })
    setMode('creer')
    setMessage('')
  }

  const openModifier = async (c: any) => {
    const res = await client.get(`/clients/${c.id}`)
    const data = res.data
    setSelected(data)
    setForm({
      code: data.code,
      raison_sociale: data.raison_sociale,
      adresse: data.adresse ?? '',
      code_postal: data.code_postal ?? '',
      ville: data.ville ?? '',
      pays: data.pays ?? 'France',
      telephone: data.telephone ?? '',
      email: data.email ?? '',
      logo_url: data.logo_url ?? '',
      actif: data.actif
    })
    setMode('modifier')
    setMessage('')
  }

  const handleSubmit = async () => {
    if (!form.code || !form.raison_sociale) {
      setMessage('Code et raison sociale sont obligatoires')
      setMessageType('error')
      return
    }
    setLoading(true)
    try {
      const payload = {
        code: form.code,
        raison_sociale: form.raison_sociale,
        adresse: form.adresse,
        code_postal: form.code_postal,
        ville: form.ville,
        pays: form.pays,
        telephone: form.telephone,
        email: form.email,
        logo_url: form.logo_url,
        actif: form.actif
      }
      let res
      if (mode === 'creer') {
        res = await client.post('/clients/', payload)
      } else {
        res = await client.put(`/clients/${selected.id}`, payload)
      }
      if (res.data.error) {
        setMessage(res.data.error)
        setMessageType('error')
      } else {
        setMessage(mode === 'creer' ? 'Client cree avec succes !' : 'Client mis a jour !')
        setMessageType('ok')
        queryClient.invalidateQueries({ queryKey: ['clients-gestion'] })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
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

  const handleDesactiver = async (id: number) => {
    if (!confirm('Desactiver ce client ?')) return
    await client.delete(`/clients/${id}`)
    queryClient.invalidateQueries({ queryKey: ['clients-gestion'] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
    refetch()
  }

  if (mode === 'creer' || mode === 'modifier') {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('liste')} className="text-slate-500 hover:text-slate-700 text-sm">← Retour</button>
          <h1 className="text-xl font-medium text-slate-800">
            {mode === 'creer' ? 'Nouveau client' : `Modifier — ${selected?.code}`}
          </h1>
        </div>

        {message && (
          <div className={`p-3 rounded-lg border mb-4 text-sm ${
            messageType === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>{message}</div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Code *</label>
              <input name="code" value={form.code} onChange={handleChange}
                disabled={mode === 'modifier'} placeholder="CLI-001"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm disabled:bg-slate-50" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Pays</label>
              <input name="pays" value={form.pays} onChange={handleChange}
                placeholder="France"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium block mb-1">Raison sociale *</label>
              <input name="raison_sociale" value={form.raison_sociale} onChange={handleChange}
                placeholder="Nom de l'entreprise"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium block mb-1">Adresse</label>
              <input name="adresse" value={form.adresse} onChange={handleChange}
                placeholder="Rue, numero..."
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Code postal</label>
              <input name="code_postal" value={form.code_postal} onChange={handleChange}
                placeholder="75000"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Ville</label>
              <input name="ville" value={form.ville} onChange={handleChange}
                placeholder="Paris"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Telephone</label>
              <input name="telephone" value={form.telephone} onChange={handleChange}
                placeholder="01 23 45 67 89"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="contact@client.fr"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium block mb-1">URL Logo</label>
              <input name="logo_url" value={form.logo_url} onChange={handleChange}
                placeholder="https://..."
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            {mode === 'modifier' && (
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" name="actif" id="actif" checked={form.actif} onChange={handleChange} />
                <label htmlFor="actif" className="text-sm text-slate-600">Client actif</label>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40 font-medium">
              {loading ? 'Sauvegarde...' : mode === 'creer' ? 'Creer client' : 'Enregistrer'}
            </button>
            <button onClick={() => setMode('liste')}
              className="px-4 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50">
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-slate-800">Gestion des clients</h1>
        <p className="text-sm text-slate-500">Creer et modifier les clients destinataires</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex justify-end mb-4">
          <button onClick={openCreer}
            className="px-4 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 font-medium">
            + Nouveau client
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Code</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Raison sociale</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Ville</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Telephone</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Email</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Statut</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients_list?.map((c: any) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-2 font-mono text-xs text-slate-600">{c.code}</td>
                <td className="p-2 font-medium">{c.raison_sociale}</td>
                <td className="p-2 text-slate-500">{c.ville ?? '—'}</td>
                <td className="p-2 text-xs text-slate-500">{c.telephone ?? '—'}</td>
                <td className="p-2 text-xs text-slate-500">{c.email ?? '—'}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {c.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="p-2 flex gap-1">
                  <button onClick={() => openModifier(c)}
                    className="px-2 py-1 border border-slate-200 rounded text-xs hover:bg-slate-100">
                    Modifier
                  </button>
                  {c.actif && (
                    <button onClick={() => handleDesactiver(c.id)}
                      className="px-2 py-1 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50">
                      Desactiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!clients_list || clients_list.length === 0) && (
          <p className="text-sm text-slate-400 text-center py-8">Aucun client — cliquez sur + Nouveau client</p>
        )}
      </div>
    </div>
  )
}
