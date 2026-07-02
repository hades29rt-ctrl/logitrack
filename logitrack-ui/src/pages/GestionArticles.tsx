import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

const UNITES = ['piece', 'kg', 'litre', 'carton', 'palette', 'rouleau', 'boite', 'metre']

export default function GestionArticles() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'liste' | 'creer' | 'modifier'>('liste')
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error'>('ok')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    reference: '', designation: '', unite: 'piece',
    stock_minimum: '0', stock_maximum: '0',
    poids_kg: '0', code_ean13: '', code_gtin14: '',
    fournisseur_id: '0', statut: 'actif'
  })

  const { data: articles, refetch } = useQuery({
    queryKey: ['articles-gestion'],
    queryFn: () => client.get('/articles/').then(r => r.data)
  })

  const { data: fournisseurs } = useQuery({
    queryKey: ['fournisseurs'],
    queryFn: () => client.get('/fournisseurs/').then(r => r.data)
  })

  const filtered = articles?.filter((a: any) =>
    a.reference.toLowerCase().includes(search.toLowerCase()) ||
    a.designation.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value })

  const openCreer = () => {
    setForm({ reference: '', designation: '', unite: 'piece', stock_minimum: '0', stock_maximum: '0', poids_kg: '0', code_ean13: '', code_gtin14: '', fournisseur_id: '0', statut: 'actif' })
    setMode('creer')
    setMessage('')
  }

  const openModifier = (art: any) => {
    setSelected(art)
    setForm({
      reference: art.reference,
      designation: art.designation,
      unite: art.unite ?? 'piece',
      stock_minimum: art.stock_minimum?.toString() ?? '0',
      stock_maximum: art.stock_maximum?.toString() ?? '0',
      poids_kg: art.poids_kg?.toString() ?? '0',
      code_ean13: art.code_ean13 ?? '',
      code_gtin14: art.code_gtin14 ?? '',
      fournisseur_id: art.fournisseur_id?.toString() ?? '0',
      statut: art.statut ?? 'actif'
    })
    setMode('modifier')
    setMessage('')
  }

  const handleSubmit = async () => {
    if (!form.reference || !form.designation) {
      setMessage('Reference et designation sont obligatoires')
      setMessageType('error')
      return
    }
    setLoading(true)
    try {
      const payload = {
        reference: form.reference,
        designation: form.designation,
        unite: form.unite,
        stock_minimum: parseInt(form.stock_minimum) || 0,
        stock_maximum: parseInt(form.stock_maximum) || 0,
        poids_kg: parseFloat(form.poids_kg) || 0,
        code_ean13: form.code_ean13,
        code_gtin14: form.code_gtin14,
        fournisseur_id: parseInt(form.fournisseur_id) || 0,
        statut: form.statut
      }

      let res
      if (mode === 'creer') {
        res = await client.post('/articles/', payload)
      } else {
        res = await client.put(`/articles/${selected.id}`, payload)
      }

      if (res.data.error) {
        setMessage(res.data.error)
        setMessageType('error')
      } else {
        setMessage(mode === 'creer' ? 'Article cree avec succes !' : 'Article mis a jour !')
        setMessageType('ok')
        queryClient.invalidateQueries({ queryKey: ['articles-gestion'] })
        queryClient.invalidateQueries({ queryKey: ['articles'] })
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

  if (mode === 'creer' || mode === 'modifier') {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('liste')} className="text-slate-500 hover:text-slate-700 text-sm">
            ← Retour
          </button>
          <h1 className="text-xl font-medium text-slate-800">
            {mode === 'creer' ? 'Nouvel article' : `Modifier — ${selected?.reference}`}
          </h1>
        </div>

        {message && (
          <div className={`p-3 rounded-lg border mb-4 text-sm ${
            messageType === 'ok'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Reference *</label>
              <input
                name="reference"
                value={form.reference}
                onChange={handleChange}
                disabled={mode === 'modifier'}
                placeholder="ART-XXXX"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Unite</label>
              <select
                name="unite"
                value={form.unite}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              >
                {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium block mb-1">Designation *</label>
              <input
                name="designation"
                value={form.designation}
                onChange={handleChange}
                placeholder="Libelle complet de l'article"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Stock minimum</label>
              <input
                type="number"
                name="stock_minimum"
                value={form.stock_minimum}
                onChange={handleChange}
                min="0"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Stock maximum</label>
              <input
                type="number"
                name="stock_maximum"
                value={form.stock_maximum}
                onChange={handleChange}
                min="0"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Code EAN-13</label>
              <input
                name="code_ean13"
                value={form.code_ean13}
                onChange={handleChange}
                placeholder="13 chiffres"
                maxLength={13}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Code GTIN-14</label>
              <input
                name="code_gtin14"
                value={form.code_gtin14}
                onChange={handleChange}
                placeholder="14 chiffres"
                maxLength={14}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Poids (kg)</label>
              <input
                type="number"
                name="poids_kg"
                value={form.poids_kg}
                onChange={handleChange}
                step="0.001"
                min="0"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Fournisseur</label>
              <select
                name="fournisseur_id"
                value={form.fournisseur_id}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              >
                <option value="0">-- Aucun --</option>
                {fournisseurs?.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.code} — {f.raison_sociale}</option>
                ))}
              </select>
            </div>

            {mode === 'modifier' && (
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Statut</label>
                <select
                  name="statut"
                  value={form.statut}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                >
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="archive">Archive</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40 font-medium"
            >
              {loading ? 'Sauvegarde...' : mode === 'creer' ? 'Creer article' : 'Enregistrer modifications'}
            </button>
            <button
              onClick={() => setMode('liste')}
              className="px-4 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-slate-800">Gestion des articles</h1>
        <p className="text-sm text-slate-500">Creer et modifier les articles du referentiel</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="border border-slate-200 rounded px-3 py-2 text-sm w-64"
          />
          <button
            onClick={openCreer}
            className="px-4 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 font-medium"
          >
            + Nouvel article
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Reference</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Designation</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Unite</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">EAN-13</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Stock min.</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Statut</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a: any) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-2 font-mono text-xs text-slate-600">{a.reference}</td>
                <td className="p-2 font-medium">{a.designation}</td>
                <td className="p-2 text-slate-500">{a.unite}</td>
                <td className="p-2 font-mono text-xs">{a.code_ean13 ?? '—'}</td>
                <td className="p-2">{a.stock_minimum}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    a.statut === 'actif' ? 'bg-green-100 text-green-700' :
                    a.statut === 'inactif' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {a.statut}
                  </span>
                </td>
                <td className="p-2">
                  <button
                    onClick={() => openModifier(a)}
                    className="px-2 py-1 border border-slate-200 rounded text-xs hover:bg-slate-100"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 text-xs text-slate-400">
          {filtered.length} article(s)
        </div>
      </div>
    </div>
  )
}
