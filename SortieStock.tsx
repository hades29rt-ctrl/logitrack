import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

export default function SortieStock() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    reference: '',
    designation: '',
    stockActuel: 0,
    quantite: '',
    numeroLot: '',
    motif: 'expedition',
    numeroCommande: '',
    destinataire: '',
    commentaire: ''
  })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')

  const { data: articles } = useQuery({
    queryKey: ['articles'],
    queryFn: () => client.get('/articles/').then(r => r.data)
  })

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setResult(null)
    setErreur('')
  }

  const handleRefChange = (e: any) => {
    const ref = e.target.value
    const article = articles?.find((a: any) => a.reference === ref)
    setForm({
      ...form,
      reference: ref,
      designation: article?.designation ?? '',
      stockActuel: article?.stock_actuel ?? 0
    })
    setResult(null)
    setErreur('')
  }

  const handleSubmit = async () => {
    if (!form.reference || !form.quantite) return
    if (parseInt(form.quantite) > form.stockActuel) {
      setErreur('Quantite superieure au stock disponible (' + form.stockActuel + ')')
      return
    }
    setLoading(true)
    setErreur('')
    try {
      const res = await client.post('/articles/sortie', {
        reference: form.reference,
        quantite: parseInt(form.quantite),
        numero_lot: form.numeroLot,
        motif: form.motif,
        numero_commande: form.numeroCommande,
        destinataire: form.destinataire,
        commentaire: form.commentaire
      })
      if (res.data.error) {
        setErreur(res.data.error)
      } else {
        setResult(res.data)
        queryClient.invalidateQueries({ queryKey: ['articles'] })
        setForm({
          reference: '', designation: '', stockActuel: 0, quantite: '',
          numeroLot: '', motif: 'expedition', numeroCommande: '', destinataire: '', commentaire: ''
        })
      }
    } catch {
      setErreur('Erreur lors de la validation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-lg md:text-xl font-medium text-slate-800">Sortie de stock</h1>
        <p className="text-sm text-slate-500">Approvisionnement — enregistrement des sorties</p>
      </div>

      {result && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          Sortie validee — {result.reference} : {result.stock_avant} - {result.quantite_retiree} = <strong>{result.stock_apres}</strong> en stock
        </div>
      )}

      {erreur && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erreur}
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 md:gap-6">

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium mb-4 pb-2 border-b border-slate-100">
            Saisie sortie de stock
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Reference article</label>
                <select
                  name="reference"
                  value={form.reference}
                  onChange={handleRefChange}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                >
                  <option value="">Selectionner...</option>
                  {articles?.map((a: any) => (
                    <option key={a.id} value={a.reference}>{a.reference}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Stock disponible</label>
                <div className="w-full border border-slate-200 rounded px-3 py-2 text-sm bg-slate-50">
                  <div className={`font-medium ${form.stockActuel > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                    {form.stockActuel > 0 ? form.stockActuel : '—'}
                  </div>
                  {form.stockActuel > 0 && (
                    <div className="text-xs text-slate-400">
                      {articles?.find((a: any) => a.reference === form.reference)?.stock_minimum
                        ? `Min: ${articles?.find((a: any) => a.reference === form.reference)?.stock_minimum}`
                        : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Quantite sortante</label>
                <input
                  type="number"
                  name="quantite"
                  value={form.quantite}
                  onChange={handleChange}
                  min="1"
                  placeholder="0"
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">N° Lot</label>
                <input
                  type="text"
                  name="numeroLot"
                  value={form.numeroLot}
                  onChange={handleChange}
                  placeholder="LOT-YYYYMMDD-XX"
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Motif sortie</label>
                <select
                  name="motif"
                  value={form.motif}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                >
                  <option value="expedition">Expedition commande</option>
                  <option value="prelevement_interne">Prelevement interne</option>
                  <option value="retour_fournisseur">Retour fournisseur</option>
                  <option value="rebut">Rebut / casse</option>
                  <option value="inventaire">Inventaire</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">N° Commande</label>
                <input
                  type="text"
                  name="numeroCommande"
                  value={form.numeroCommande}
                  onChange={handleChange}
                  placeholder="CMD-XXXX"
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Destinataire</label>
              <input
                type="text"
                name="destinataire"
                value={form.destinataire}
                onChange={handleChange}
                placeholder="Client ou service interne"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Commentaire</label>
              <textarea
                name="commentaire"
                value={form.commentaire}
                onChange={handleChange}
                rows={2}
                placeholder="Motif detaille si rebut ou retour..."
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              La sortie decrementera le stock disponible et mettra a jour l'historique.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!form.reference || !form.quantite || loading}
                className="flex-1 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Validation...' : 'Valider sortie'}
              </button>
              <button
                onClick={() => { setForm({ reference: '', designation: '', stockActuel: 0, quantite: '', numeroLot: '', motif: 'expedition', numeroCommande: '', destinataire: '', commentaire: '' }); setErreur(''); setResult(null) }}
                className="px-4 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50"
              >
                Reinitialiser
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium mb-4 pb-2 border-b border-slate-100">
            Stock disponible
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Ref.</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Designation</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Stock</th>
                  <th className="text-left p-2 text-xs text-slate-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {articles?.map((a: any) => {
                  const critique = a.stock_actuel <= a.stock_minimum
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setForm({ ...form, reference: a.reference, designation: a.designation, stockActuel: a.stock_actuel })}
                      className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer"
                    >
                      <td className="p-2 font-mono text-xs text-slate-600">{a.reference}</td>
                      <td className="p-2 text-xs">{a.designation}</td>
                      <td className="p-2">
                        <div className={`font-medium text-sm ${critique ? 'text-red-600' : 'text-green-600'}`}>
                          {a.stock_actuel}
                        </div>
                        <div className="text-xs text-slate-400">
                          Min: {a.stock_minimum}
                        </div>
                      </td>
                      <td className="p-2">
                        <span className={critique ? 'px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700' : 'px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700'}>
                          {critique ? 'Critique' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">Cliquez sur un article pour le selectionner</p>
        </div>

      </div>
    </div>
  )
}
