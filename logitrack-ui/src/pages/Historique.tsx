import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

export default function Historique() {
  const [filtreType, setFiltreType] = useState('')
  const [filtreArticle, setFiltreArticle] = useState('')
  const [dateDebut, setDateDebut] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [dateFin, setDateFin] = useState(new Date().toISOString().slice(0, 10))

  const { data: mouvements, isLoading, refetch } = useQuery({
    queryKey: ['mouvements', filtreType, filtreArticle, dateDebut, dateFin],
    queryFn: () => client.get('/mouvements/', {
      params: {
        type_mvt: filtreType || undefined,
        reference: filtreArticle || undefined,
        date_debut: dateDebut || undefined,
        date_fin: dateFin || undefined,
        limit: 200
      }
    }).then(r => r.data)
  })

  const { data: articles } = useQuery({
    queryKey: ['articles'],
    queryFn: () => client.get('/articles/').then(r => r.data)
  })

  const totalEntrees = mouvements?.filter((m: any) => m.type_mvt === 'entree').length ?? 0
  const totalSorties = mouvements?.filter((m: any) => m.type_mvt === 'sortie').length ?? 0
  const qteEntrees = mouvements?.filter((m: any) => m.type_mvt === 'entree').reduce((s: number, m: any) => s + m.quantite, 0) ?? 0
  const qteSorties = mouvements?.filter((m: any) => m.type_mvt === 'sortie').reduce((s: number, m: any) => s + m.quantite, 0) ?? 0

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg md:text-xl font-medium text-slate-800">Historique des mouvements</h1>
        <p className="text-sm text-slate-500">Toutes les entrees et sorties de stock</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-xl font-medium text-green-600">{totalEntrees}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Entrees</div>
          <div className="text-xs text-green-600 font-medium">+{qteEntrees} u.</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-xl font-medium text-red-600">{totalSorties}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Sorties</div>
          <div className="text-xs text-red-600 font-medium">-{qteSorties} u.</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-xl font-medium text-slate-800">{(mouvements?.length ?? 0)}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Total mouvements</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-xl font-medium text-blue-600">{qteEntrees - qteSorties}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Solde net</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Type</label>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
              className="border border-slate-200 rounded px-3 py-1.5 text-sm">
              <option value="">Tous</option>
              <option value="entree">Entrees</option>
              <option value="sortie">Sorties</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Article</label>
            <select value={filtreArticle} onChange={e => setFiltreArticle(e.target.value)}
              className="border border-slate-200 rounded px-3 py-1.5 text-sm">
              <option value="">Tous les articles</option>
              {articles?.map((a: any) => (
                <option key={a.id} value={a.reference}>{a.reference} — {a.designation}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Du</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
              className="border border-slate-200 rounded px-3 py-1.5 text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Au</label>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
              className="border border-slate-200 rounded px-3 py-1.5 text-sm" />
          </div>

          <div className="flex items-end gap-2">
            <button onClick={() => refetch()}
              className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">
              Filtrer
            </button>
            <button onClick={() => {
              setFiltreType('')
              setFiltreArticle('')
              setDateDebut(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
              setDateFin(new Date().toISOString().slice(0, 10))
            }}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm hover:bg-slate-50">
              Reinitialiser
            </button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-slate-400 py-4 text-center">Chargement...</p>}

        {!isLoading && mouvements?.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">Aucun mouvement sur cette periode</p>
        )}

        {!isLoading && mouvements?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Date / Heure</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Type</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Reference</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Designation</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Motif</th>
                  <th className="text-right p-2 text-xs text-slate-500 uppercase">Quantite</th>
                  <th className="text-right p-2 text-xs text-slate-500 uppercase">Avant</th>
                  <th className="text-right p-2 text-xs text-slate-500 uppercase">Apres</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Ref. doc</th>
                </tr>
              </thead>
              <tbody>
                {mouvements?.map((m: any) => (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-2 text-xs text-slate-500">
                      {new Date(m.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.type_mvt === 'entree'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {m.type_mvt === 'entree' ? '↑ Entree' : '↓ Sortie'}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs text-slate-600">{m.reference}</td>
                    <td className="p-2 text-xs">{m.designation}</td>
                    <td className="p-2 text-xs text-slate-500">{m.motif_entree || m.motif_sortie || '—'}</td>
                    <td className="p-2 text-right">
                      <span className={`font-medium ${
                        m.type_mvt === 'entree' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {m.type_mvt === 'entree' ? '+' : '-'}{m.quantite}
                      </span>
                    </td>
                    <td className="p-2 text-right text-slate-500">{m.stock_avant}</td>
                    <td className="p-2 text-right font-medium">{m.stock_apres}</td>
                    <td className="p-2 text-xs text-slate-400 font-mono">{m.reference_doc || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mouvements?.length > 0 && (
          <div className="mt-3 text-xs text-slate-400">
            {mouvements.length} mouvement(s) affiches — 200 max
          </div>
        )}
      </div>
    </div>
  )
}
