import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

export default function Articles() {
  const [search, setSearch] = useState('')

  const { data: articles, isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: () => client.get('/articles/').then(r => r.data)
  })

  const filtered = articles?.filter((a: any) =>
    a.reference.toLowerCase().includes(search.toLowerCase()) ||
    a.designation.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-slate-800">Articles</h1>
        <p className="text-sm text-slate-500">Référentiel complet des articles</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une référence ou désignation..."
            className="border border-slate-200 rounded px-3 py-2 text-sm w-72"
          />
          <span className="text-sm text-slate-500">
            {filtered?.length ?? 0} article(s)
          </span>
        </div>

        {isLoading && <p className="text-sm text-slate-400 py-4">Chargement...</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Référence</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Désignation</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Unité</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Stock actuel</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Seuil min.</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((a: any) => {
  // On utilise les nouveaux noms 'stock' et 'stock_min' définis dans le SQL
  return (
    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
      <td className="p-2 font-mono text-xs text-slate-600">{a.reference}</td>
      <td className="p-2 font-medium">{a.designation}</td>
      <td className="p-2 text-slate-500">{a.unite}</td>
      <td className="p-2">
        {/* On utilise a.stock ici */}
        <span className={`font-medium ${a.statut.includes('⚠️') ? 'text-red-600' : 'text-green-600'}`}>
          {a.stock}
        </span>
      </td>
      {/* On utilise a.stock_min ici */}
      <td className="p-2 text-slate-500">{a.stock_min}</td>
      <td className="p-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
          ${a.statut.includes('⚠️') 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'}`}>
          {a.statut} {/* Affiche '⚠️ Réappro' ou '✅ OK' direct du SQL */}
        </span>
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