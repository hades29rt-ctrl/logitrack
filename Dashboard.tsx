import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

export default function Dashboard() {
  const { data: articles, isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: () => client.get('/articles/').then(r => r.data)
  })

  const total    = articles?.length ?? 0
  const critiques = articles?.filter((a: any) => a.stock_actuel <= a.stock_minimum).length ?? 0
  const ok       = total - critiques

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-slate-800">Tableau de bord</h1>
        <p className="text-sm text-slate-500">Vue en temps reel — Entrepot principal</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Articles total</div>
          <div className="text-3xl font-medium text-slate-800">{total}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Stock OK</div>
          <div className="text-3xl font-medium text-green-600">{ok}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Stock critique</div>
          <div className="text-3xl font-medium text-red-600">{critiques}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Alertes actives</div>
          <div className="text-3xl font-medium text-amber-500">{critiques}</div>
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
                : 50
              return (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs text-slate-500">{a.reference}</td>
                  <td className="p-2">{a.designation}</td>
                  <td className="p-2 font-medium">{a.stock_actuel}</td>
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