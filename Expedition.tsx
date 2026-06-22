import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

interface Palette {
  emplacement: string
  article_ref: string
  article_designation: string
  numero_lot: string
  stock_total: number
  quantite_expedition: number
  poids_reel: number
  nb_palettes_lot: number
  date_entree: string
  article_id: number
  lot_id: number
}

interface ScanEnCours {
  emplacement: string
  article_ref: string
  article_designation: string
  numero_lot: string
  stock_total: number
  article_id: number
  lot_id: number
  date_entree: string
}

const EXPEDITEUR = {
  nom: 'LogiTrack Pro',
  adresse: '1 rue de la Logistique',
  cp: '75000',
  ville: 'Paris',
  pays: 'France',
  tel: '01 23 45 67 89',
  email: 'contact@logitrack.fr'
}

export default function Expedition() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'scan' | 'impression'>('scan')
  const [palettes, setPalettes] = useState<Palette[]>([])
  const [scanEnCours, setScanEnCours] = useState<ScanEnCours | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [quantiteSaisie, setQuantiteSaisie] = useState('')
  const [poidsSaisie, setPoidsSaisie] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error' | 'info'>('info')
  const [loading, setLoading] = useState(false)
  const [blData, setBlData] = useState<any>(null)
  const [modeClient, setModeClient] = useState<'liste' | 'creer'>('liste')
  const [loadingClient, setLoadingClient] = useState(false)

  const [formBL, setFormBL] = useState({
    numero_cmd: `CMD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*100).toString().padStart(2,'0')}`,
    client_id: '',
    transporteur: '',
    priorite: 'normal',
  })

  const [formClient, setFormClient] = useState({
    code: '', raison_sociale: '', adresse: '',
    code_postal: '', ville: '', pays: 'France',
    telephone: '', email: '', logo_url: ''
  })

  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastKeyRef = useRef(0)

  const { data: clients_list, refetch: refetchClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => client.get('/clients/').then(r => r.data)
  })

  const parseQteCode = (raw: string): number | null => {
    const m30 = raw.match(/\(30\)(\d+)/)
    if (m30) return parseInt(m30[1])
    const m37 = raw.match(/\(37\)(\d+)/)
    if (m37) return parseInt(m37[1])
    if (/^\d+$/.test(raw)) return parseInt(raw)
    return null
  }

  const handleScan = useCallback(async (raw: string) => {
    if (raw.length < 2) return
    const code = raw.trim().toUpperCase()
    setScanCode('')

    if (scanEnCours) {
      const qte = parseQteCode(raw)
      if (qte !== null) {
        setQuantiteSaisie(Math.min(qte, scanEnCours.stock_total).toString())
        setMessage(`Quantite scannee : ${qte} unites`)
        setMessageType('info')
        return
      }
      if (code === 'PALETTE' || code === 'PAL') {
        setQuantiteSaisie(scanEnCours.stock_total.toString())
        setMessage(`Palette entiere selectionnee : ${scanEnCours.stock_total} unites`)
        setMessageType('info')
        return
      }
    }

    if (palettes.find(p => p.emplacement === code)) {
      setMessage(`Emplacement ${code} deja dans la liste`)
      setMessageType('error')
      return
    }

    setLoading(true)
    try {
      const res = await client.post('/expedition/scan', {
        bl_id: 0,
        emplacement: code,
        poids_reel: 0
      })

      if (res.data.error) {
        setMessage(res.data.error)
        setMessageType('error')
        return
      }

      setScanEnCours({
        emplacement: res.data.emplacement,
        article_ref: res.data.article_ref,
        article_designation: res.data.article_designation,
        numero_lot: res.data.numero_lot,
        stock_total: res.data.quantite,
        article_id: res.data.article_id,
        lot_id: res.data.lot_id,
        date_entree: res.data.date_entree
      })
      setQuantiteSaisie(res.data.quantite.toString())
      setPoidsSaisie('')
      setMessage(`Palette identifiee — saisissez la quantite et le poids`)
      setMessageType('info')

    } catch {
      setMessage('Erreur de communication')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }, [scanEnCours, palettes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now()
      if (now - lastKeyRef.current > 80) bufferRef.current = ''
      lastKeyRef.current = now
      if (e.key === 'Enter') {
        clearTimeout(timerRef.current)
        if (bufferRef.current.length > 1) handleScan(bufferRef.current)
        bufferRef.current = ''
        return
      }
      if (e.key.length === 1) bufferRef.current += e.key
      timerRef.current = setTimeout(() => {
        if (bufferRef.current.length > 1) handleScan(bufferRef.current)
        bufferRef.current = ''
      }, 250)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleScan])

  const validerPalette = () => {
    if (!scanEnCours) return
    const qte = parseInt(quantiteSaisie) || 0
    const poids = parseFloat(poidsSaisie) || 0
    if (qte <= 0) { setMessage('Quantite invalide'); setMessageType('error'); return }
    if (qte > scanEnCours.stock_total) {
      setMessage(`Quantite superieure au stock (${scanEnCours.stock_total})`); setMessageType('error'); return
    }

    const palette: Palette = {
      emplacement: scanEnCours.emplacement,
      article_ref: scanEnCours.article_ref,
      article_designation: scanEnCours.article_designation,
      numero_lot: scanEnCours.numero_lot,
      stock_total: scanEnCours.stock_total,
      quantite_expedition: qte,
      poids_reel: poids,
      nb_palettes_lot: 1,
      date_entree: scanEnCours.date_entree,
      article_id: scanEnCours.article_id,
      lot_id: scanEnCours.lot_id
    }

    setPalettes(prev => [...prev, palette])
    setScanEnCours(null)
    setQuantiteSaisie('')
    setPoidsSaisie('')
    setMessage(`Palette ajoutee — ${palette.article_ref} ${palette.quantite_expedition} u.`)
    setMessageType('ok')
    setTimeout(() => setMessage(''), 2000)
  }

  const annulerScan = () => {
    setScanEnCours(null)
    setQuantiteSaisie('')
    setPoidsSaisie('')
    setMessage('')
  }

  const retirerPalette = (emplacement: string) => {
    setPalettes(prev => prev.filter(p => p.emplacement !== emplacement))
  }

  const totalPoids = palettes.reduce((sum, p) => sum + (p.poids_reel || 0), 0)
  const totalPalettes = palettes.length
  const totalUnites = palettes.reduce((sum, p) => sum + p.quantite_expedition, 0)

  const creerClient = async () => {
    if (!formClient.code || !formClient.raison_sociale) {
      setMessage('Code et raison sociale obligatoires'); setMessageType('error'); return
    }
    setLoadingClient(true)
    try {
      const res = await client.post('/clients/', formClient)
      if (res.data.error) { setMessage(res.data.error); setMessageType('error'); return }
      await refetchClients()
      setFormBL({ ...formBL, client_id: res.data.id.toString() })
      setModeClient('liste')
      setFormClient({ code: '', raison_sociale: '', adresse: '', code_postal: '', ville: '', pays: 'France', telephone: '', email: '', logo_url: '' })
      setMessage(`Client ${res.data.raison_sociale} cree`)
      setMessageType('ok')
    } catch {
      setMessage('Erreur creation client'); setMessageType('error')
    } finally {
      setLoadingClient(false)
    }
  }

  const creerBL = async () => {
    if (!formBL.client_id || palettes.length === 0) return
    setLoading(true)
    try {
      const res = await client.post('/expedition/bls', {
        numero_cmd: formBL.numero_cmd,
        client_id: parseInt(formBL.client_id),
        transporteur: formBL.transporteur,
        priorite: formBL.priorite,
        commentaire: ''
      })
      if (res.data.error) { setMessage(res.data.error); setMessageType('error'); return }

      const newBlId = res.data.id
      for (const palette of palettes) {
        await client.post(`/expedition/bls/${newBlId}/lignes`, {
          bl_id: newBlId,
          emplacement: palette.emplacement,
          poids_reel: palette.poids_reel,
          quantite_expedition: palette.quantite_expedition
        })
      }

      const blDetail = await client.get(`/expedition/bls/${newBlId}`)
      setBlData(blDetail.data)
      setStep('impression')
      queryClient.invalidateQueries({ queryKey: ['articles'] })

    } catch {
      setMessage('Erreur creation BL'); setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const validerBL = async () => {
    if (!blData?.id) return
    setLoading(true)
    try {
      await client.post(`/expedition/bls/${blData.id}/valider`)
      setMessage('BL valide — stock et emplacements mis a jour !')
      setMessageType('ok')
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      queryClient.invalidateQueries({ queryKey: ['emplacements'] })
    } catch {
      setMessage('Erreur validation'); setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const msgColor: Record<string, string> = {
    ok:    'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info:  'bg-blue-50 border-blue-200 text-blue-700',
  }

  const clientSelectionne = clients_list?.find((c: any) => c.id === parseInt(formBL.client_id))

  if (step === 'impression' && blData) {
    return (
      <>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #bon-livraison, #bon-livraison * { visibility: visible; }
            #bon-livraison { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            .page-break { page-break-after: always; }
          }
        `}</style>
        <div className="p-4 md:p-6 no-print">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setStep('scan')} className="text-slate-500 hover:text-slate-700 text-sm">← Retour</button>
            <h1 className="text-xl font-medium text-slate-800">Bon de livraison — {blData.numero_cmd}</h1>
          </div>
          {message && <div className={`p-3 rounded-lg border mb-4 text-sm ${msgColor[messageType]}`}>{message}</div>}
          <div className="flex gap-3 mb-6">
            <button onClick={() => window.print()}
              className="px-6 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 font-medium">
              🖨 Imprimer (2 exemplaires)
            </button>
            <button onClick={validerBL} disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium disabled:opacity-40">
              {loading ? 'Validation...' : '✓ Valider expedition'}
            </button>
          </div>
        </div>

        <div id="bon-livraison" className="p-8 max-w-4xl mx-auto">
          {[1, 2].map(exemplaire => (
            <div key={exemplaire} className={exemplaire === 1 ? 'page-break' : ''}>
              <div className="text-xs text-slate-400 text-right mb-2">
                Exemplaire {exemplaire === 1 ? '1/2 — Expediteur' : '2/2 — Transporteur'}
              </div>
              <div className="flex justify-between items-start mb-6 border-b-2 border-slate-800 pb-4">
                <div className="w-1/2">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Destinataire</div>
                  {blData.client_logo && <img src={blData.client_logo} alt="logo" className="h-12 mb-2 object-contain" />}
                  <div className="font-bold text-lg text-slate-800">{blData.client_nom}</div>
                  <div className="text-sm text-slate-600">{blData.client_adresse}</div>
                  <div className="text-sm text-slate-600">{blData.client_cp} {blData.client_ville}</div>
                  <div className="text-sm text-slate-600">{blData.client_pays}</div>
                </div>
                <div className="w-1/2 text-right">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Expediteur</div>
                  <div className="font-bold text-lg text-slate-800">{EXPEDITEUR.nom}</div>
                  <div className="text-sm text-slate-600">{EXPEDITEUR.adresse}</div>
                  <div className="text-sm text-slate-600">{EXPEDITEUR.cp} {EXPEDITEUR.ville}</div>
                  <div className="text-sm text-slate-600">{EXPEDITEUR.tel}</div>
                  <div className="text-sm text-slate-600">{EXPEDITEUR.email}</div>
                </div>
              </div>
              <div className="bg-slate-800 text-white p-3 flex justify-between items-center mb-0">
                <div>
                  <span className="font-bold text-lg">BON DE LIVRAISON</span>
                  <span className="ml-4 text-slate-300">{blData.numero_cmd}</span>
                </div>
                <div className="text-sm text-slate-300">{new Date().toLocaleDateString('fr-FR')}</div>
              </div>
              <div className="border border-slate-200 p-3 mb-4 flex gap-6 text-sm">
                <div><span className="text-slate-500">Transporteur :</span> <strong>{blData.transporteur || '—'}</strong></div>
                <div><span className="text-slate-500">Priorite :</span> <strong>{blData.priorite}</strong></div>
                <div><span className="text-slate-500">Date :</span> <strong>{new Date().toLocaleDateString('fr-FR')}</strong></div>
              </div>
              <table className="w-full text-sm mb-4 border border-slate-200">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-2 border border-slate-200">Emplacement</th>
                    <th className="text-left p-2 border border-slate-200">Reference</th>
                    <th className="text-left p-2 border border-slate-200">Designation</th>
                    <th className="text-left p-2 border border-slate-200">N° Lot</th>
                    <th className="text-right p-2 border border-slate-200">Quantite</th>
                    <th className="text-right p-2 border border-slate-200">Poids (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {blData.lignes?.map((l: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 border border-slate-200 font-mono text-xs">{l.emplacement}</td>
                      <td className="p-2 border border-slate-200 font-mono text-xs">{l.article_ref}</td>
                      <td className="p-2 border border-slate-200">{l.article_designation}</td>
                      <td className="p-2 border border-slate-200 font-mono text-xs">{l.numero_lot}</td>
                      <td className="p-2 border border-slate-200 text-right">{l.quantite}</td>
                      <td className="p-2 border border-slate-200 text-right font-medium">{Number(l.poids_reel).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between items-start">
                <div className="bg-slate-800 text-white p-4 rounded text-center min-w-48">
                  <div className="text-2xl font-bold">{blData.nb_palettes}</div>
                  <div className="text-xs uppercase tracking-wide">Palettes chargees</div>
                  <div className="text-xl font-bold mt-1">{Number(blData.poids_total).toFixed(3)} kg</div>
                  <div className="text-xs uppercase tracking-wide">Poids total</div>
                </div>
                <div className="flex gap-8 text-sm">
                  <div className="text-center">
                    <div className="text-slate-500 mb-8">Signature expediteur</div>
                    <div className="border-t border-slate-400 w-32 pt-1 text-xs text-slate-400">Date et signature</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500 mb-8">Signature transporteur</div>
                    <div className="border-t border-slate-400 w-32 pt-1 text-xs text-slate-400">Date et signature</div>
                  </div>
                </div>
              </div>
              {exemplaire === 1 && (
                <div className="mt-8 border-t-2 border-dashed border-slate-400 pt-2 text-center text-xs text-slate-400">
                  — Couper ici —
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg md:text-xl font-medium text-slate-800">Expedition</h1>
        <p className="text-sm text-slate-500">Scan des palettes et creation du bon de livraison</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border mb-4 text-sm ${msgColor[messageType]}`}>{message}</div>
      )}

      <div className="flex flex-col lg:grid gap-4 md:gap-6" style={{gridTemplateColumns: '2fr 3fr'}}>

        <div className="space-y-4">

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100">Scan palette</h2>

            <div className={`flex items-center gap-2 p-2 rounded-lg border mb-3 text-xs ${
              loading ? 'bg-blue-50 border-blue-200 text-blue-700' :
              scanEnCours ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-green-50 border-green-200 text-green-700'
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                loading ? 'bg-blue-500' :
                scanEnCours ? 'bg-amber-500 animate-pulse' :
                'bg-green-500 animate-pulse'
              }`}></div>
              {loading ? 'Traitement...' :
               scanEnCours ? 'Saisissez quantite + poids puis validez' :
               'Douchette active — scannez un emplacement'}
            </div>

            {!scanEnCours ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">Emplacement</label>
                  <input type="text" value={scanCode} onChange={e => setScanCode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleScan(scanCode) }}
                    placeholder="A-01-00" className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => handleScan(scanCode)} disabled={loading}
                    className="px-3 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40">
                    Scanner
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded p-3 text-sm">
                  <div className="font-medium text-slate-800">{scanEnCours.article_ref} — {scanEnCours.article_designation}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Lot : {scanEnCours.numero_lot} | Stock total : <strong>{scanEnCours.stock_total}</strong> u.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">
                      Quantite a expedier *
                    </label>
                    <input type="number" value={quantiteSaisie}
                      onChange={e => setQuantiteSaisie(e.target.value)}
                      min="1" max={scanEnCours.stock_total}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-medium" />
                    <div className="text-xs text-slate-400 mt-1">
                      Max : {scanEnCours.stock_total} u.
                      <button onClick={() => setQuantiteSaisie(scanEnCours.stock_total.toString())}
                        className="ml-2 text-blue-500 underline">Tout</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">
                      Poids reel (kg)
                    </label>
                    <input type="number" value={poidsSaisie}
                      onChange={e => setPoidsSaisie(e.target.value)}
                      step="0.001" placeholder="0.000"
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={validerPalette}
                    disabled={!quantiteSaisie || parseInt(quantiteSaisie) <= 0}
                    className="flex-1 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-40 font-medium">
                    ✓ Ajouter au BL
                  </button>
                  <button onClick={annulerScan}
                    className="px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100">Entete BL</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">N° Commande</label>
                  <input type="text" value={formBL.numero_cmd}
                    onChange={e => setFormBL({ ...formBL, numero_cmd: e.target.value })}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Transporteur</label>
                  <input type="text" value={formBL.transporteur}
                    onChange={e => setFormBL({ ...formBL, transporteur: e.target.value })}
                    placeholder="DHL, TNT..."
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-500 font-medium">Client destinataire *</label>
                  <button onClick={() => setModeClient(modeClient === 'liste' ? 'creer' : 'liste')}
                    className="text-xs text-blue-600 hover:text-blue-800 underline">
                    {modeClient === 'liste' ? '+ Nouveau client' : '← Liste clients'}
                  </button>
                </div>

                {modeClient === 'liste' ? (
                  <>
                    <select value={formBL.client_id}
                      onChange={e => setFormBL({ ...formBL, client_id: e.target.value })}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                      <option value="">Selectionner un client...</option>
                      {clients_list?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.raison_sociale} — {c.ville}</option>
                      ))}
                    </select>
                    {clientSelectionne && (
                      <div className="bg-slate-50 rounded p-2 text-xs text-slate-600 mt-1">
                        {clientSelectionne.adresse && <div>{clientSelectionne.adresse}</div>}
                        <div>{clientSelectionne.code_postal} {clientSelectionne.ville} — {clientSelectionne.pays}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
                    <div className="text-xs font-medium text-blue-700 mb-2">Nouveau client</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Code *</label>
                        <input type="text" value={formClient.code}
                          onChange={e => setFormClient({ ...formClient, code: e.target.value })}
                          placeholder="CLI-001" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Raison sociale *</label>
                        <input type="text" value={formClient.raison_sociale}
                          onChange={e => setFormClient({ ...formClient, raison_sociale: e.target.value })}
                          placeholder="Nom societe" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Adresse</label>
                      <input type="text" value={formClient.adresse}
                        onChange={e => setFormClient({ ...formClient, adresse: e.target.value })}
                        placeholder="Rue, numero..." className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Code postal</label>
                        <input type="text" value={formClient.code_postal}
                          onChange={e => setFormClient({ ...formClient, code_postal: e.target.value })}
                          placeholder="75000" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Ville</label>
                        <input type="text" value={formClient.ville}
                          onChange={e => setFormClient({ ...formClient, ville: e.target.value })}
                          placeholder="Paris" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Telephone</label>
                        <input type="text" value={formClient.telephone}
                          onChange={e => setFormClient({ ...formClient, telephone: e.target.value })}
                          placeholder="01 23 45 67 89" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Email</label>
                        <input type="email" value={formClient.email}
                          onChange={e => setFormClient({ ...formClient, email: e.target.value })}
                          placeholder="contact@..." className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                    <button onClick={creerClient}
                      disabled={loadingClient || !formClient.code || !formClient.raison_sociale}
                      className="w-full py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-40 font-medium">
                      {loadingClient ? 'Creation...' : 'Creer et selectionner ce client'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Priorite</label>
                <select value={formBL.priorite} onChange={e => setFormBL({ ...formBL, priorite: e.target.value })}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="differe">Differe</option>
                </select>
              </div>

              <button onClick={creerBL}
                disabled={!formBL.client_id || palettes.length === 0 || loading || modeClient === 'creer' || !!scanEnCours}
                className="w-full py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40 font-medium">
                {loading ? 'Creation...' : `Creer BL (${palettes.length} palette${palettes.length > 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h2 className="text-sm font-medium">Palettes a expedier</h2>
            <div className="flex gap-3 text-xs text-slate-500">
              <span><strong className="text-slate-800">{totalPalettes}</strong> palette{totalPalettes > 1 ? 's' : ''}</span>
              <span><strong className="text-slate-800">{totalUnites}</strong> u.</span>
              <span><strong className="text-slate-800">{totalPoids.toFixed(3)}</strong> kg</span>
            </div>
          </div>

          {palettes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-sm">Scannez des emplacements pour ajouter des palettes</p>
            </div>
          ) : (
            <table className="w-full" style={{fontSize:'11px', tableLayout:'fixed' as const}}>
              <colgroup>
                <col style={{width:'18%'}} />
                <col style={{width:'34%'}} />
                <col style={{width:'12%'}} />
                <col style={{width:'12%'}} />
                <col style={{width:'20%'}} />
                <col style={{width:'4%'}} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-1 text-slate-500 uppercase">Empl.</th>
                  <th className="text-left p-1 text-slate-500 uppercase">Art / Lot</th>
                  <th className="text-right p-1 text-slate-500 uppercase">Qte</th>
                  <th className="text-right p-1 text-slate-500 uppercase">/ Total</th>
                  <th className="text-right p-1 text-slate-500 uppercase">Poids kg</th>
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody>
                {palettes.map((p, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-1 font-mono text-slate-600 truncate">{p.emplacement}</td>
                    <td className="p-1">
                      <div className="font-medium text-slate-700 truncate">{p.article_ref}</div>
                      <div className="text-slate-400 truncate">{p.numero_lot}</div>
                    </td>
                    <td className="p-1 text-right font-medium text-blue-600">{p.quantite_expedition}</td>
                    <td className="p-1 text-right text-slate-400">{p.stock_total}</td>
                    <td className="p-1 text-right">
                      <input type="number" value={p.poids_reel || ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0
                          setPalettes(prev => prev.map((pp, ii) => ii === i ? { ...pp, poids_reel: val } : pp))
                        }}
                        step="0.001" placeholder="0.000"
                        className="w-full border border-slate-200 rounded px-1 py-0.5 text-right" />
                    </td>
                    <td className="p-1 text-center">
                      <button onClick={() => retirerPalette(p.emplacement)}
                        className="text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="p-1 font-medium text-slate-600">TOTAL</td>
                  <td className="p-1 text-right font-bold text-blue-600">{totalUnites}</td>
                  <td className="p-1 text-right text-slate-400">{palettes.reduce((s,p) => s+p.stock_total, 0)}</td>
                  <td className="p-1 text-right font-bold">{totalPoids.toFixed(3)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
