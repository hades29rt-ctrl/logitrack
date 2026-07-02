import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import client from '../api/client'

export default function Dashboard() {
  const { data: articles, isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: () => client.get('/articles/').then(r => r.data),
    refetchInterval: 30000
  })

  const { data: evolution } = useQuery({
    queryKey: ['evolution-stock'],
    queryFn: () => client.get('/mouvements/stats/evolution?jours=30').then(r => r.data),
    refetchInterval: 60000
  })

  const { data: topArticles } = useQuery({
    queryKey: ['top-articles'],
    queryFn: () => client.get('/mouvements/stats/top-articles?limit=10').then(r => r.data),
    refetchInterval: 60000
  })

  const total     = articles?.length ?? 0
  const critiques = articles?.filter((a: any) => a.stock_actuel <= a.stock_minimum).length ?? 0
  const ok        = total - critiques
  const stockTotal = articles?.reduce((s: number, a: any) => s + a.stock_actuel, 0) ?? 0

  const evolutionFormatted = evolution?.map((e: any) => ({
    jour: new Date(e.jour).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    Entrees: e.total_entrees,
    Sorties: e.total_sorties,
    Solde: e.total_entrees - e.total_sorties
  })) ?? []

  const topFormatted = topArticles?.map((a: any) => ({
    name: a.reference,
    designation: a.designation,
    Mouvements: a.nb_mouvements,
    Entrees: a.total_entrees,
    Sorties: a.total_sorties
  })) ?? []

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-slate-800">Tableau de bord</h1>
        <p className="text-sm text-slate-500">Vue en temps reel — Entrepot principal</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Articles total</div>
          <div className="text-3xl font-medium text-slate-800">{total}</div>
          <div className="text-xs text-slate-400 mt-1">{stockTotal.toLocaleString()} unites en stock</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Stock OK</div>
          <div className="text-3xl font-medium text-green-600">{ok}</div>
          <div className="text-xs text-slate-400 mt-1">Au-dessus du seuil</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Stock critique</div>
          <div className="text-3xl font-medium text-red-600">{critiques}</div>
          <div className="text-xs text-slate-400 mt-1">En dessous du seuil</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Alertes actives</div>
          <div className="text-3xl font-medium text-amber-500">{critiques}</div>
          <div className="text-xs text-slate-400 mt-1">Reapprovisionnement</div>
        </div>
      </div>

      {critiques > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          <div className="text-sm font-medium text-red-700 mb-2">
            ⚠ Articles en stock critique
          </div>
          <div className="flex flex-wrap gap-2">
            {articles?.filter((a: any) => a.stock_actuel <= a.stock_minimum).map((a: any) => (
              <div key={a.id} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                {a.reference} — {a.stock_actuel}/{a.stock_minimum}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium mb-4 pb-2 border-b border-slate-100">
            Evolution du stock — 30 derniers jours
          </h2>
          {evolutionFormatted.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Aucun mouvement sur les 30 derniers jours
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={evolutionFormatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="jour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Entrees" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Sorties" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Solde" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium mb-4 pb-2 border-b border-slate-100">
            Top 10 articles les plus mouvementes — 30 jours
          </h2>
          {topFormatted.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Aucun mouvement sur les 30 derniers jours
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topFormatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip
                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  formatter={(value: any, name: string) => [value, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Entrees" fill="#16a34a" radius={[0, 2, 2, 0]} />
                <Bar dataKey="Sorties" fill="#dc2626" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-medium mb-4 pb-2 border-b border-slate-100">
          Niveaux de stock
        </h2>

        {isLoading && <p className="text-sm text-slate-400 py-4">Chargement...</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Reference</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Designation</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Stock</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Seuil</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Niveau</th>
              <th className="text-left p-2 text-xs text-slate-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody>
            {articles?.map((a: any) => {
              const critique = a.stock_actuel <= a.stock_minimum
              const pct = a.stock_maximum
                ? Math.round(a.stock_actuel / a.stock_maximum * 100)
                : Math.min(Math.round(a.stock_actuel / (a.stock_minimum || 1) * 50), 100)
              return (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs text-slate-500">{a.reference}</td>
                  <td className="p-2">{a.designation}</td>
                  <td className="p-2">
                    <div className={`font-medium ${critique ? 'text-red-600' : 'text-green-600'}`}>
                      {a.stock_actuel}
                    </div>
                    <div className="text-xs text-slate-400">Min: {a.stock_minimum}</div>
                  </td>
                  <td className="p-2 text-slate-500">{a.stock_minimum}</td>
                  <td className="p-2">
                    <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${critique ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      critique ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {critique ? 'Critique' : 'OK'}
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
