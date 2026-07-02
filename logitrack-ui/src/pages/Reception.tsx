import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

type ReceptionStep = 'attente_scan' | 'choisir_emplacement' | 'confirmer' | 'succes' | 'erreur'

interface ScanData {
  raw: string
  ref: string
  lot: string
  qty: number
  date: string
  sscc: string
  ts: Date
}

interface ScanEntry {
  scan: ScanData
  emplacement: string
  ts: Date
}

function parseEAN128(raw: string): ScanData {
  const ref  = raw.match(/\(400\)([^(]+)/)?.[1]
             ?? raw.match(/\(01\)(\d{14})/)?.[1]
             ?? raw.match(/\(02\)([^(]+)/)?.[1]
             ?? raw
  const lot  = raw.match(/\(10\)([^(]+)/)?.[1] ?? ''
  const qty  = parseInt(raw.match(/\(37\)(\d+)/)?.[1] ?? '1')
  const date = raw.match(/\(11\)(\d{6})/)?.[1]
             ?? raw.match(/\(17\)(\d{6})/)?.[1]
             ?? new Date().toISOString().slice(2,8).replace(/-/g,'')
  const sscc = raw.match(/\(00\)(\d{18})/)?.[1] ?? ''
  return { raw, ref, lot, qty, date, sscc, ts: new Date() }
}

export default function Reception() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<ReceptionStep>('attente_scan')
  const [scanData, setScanData] = useState<ScanData | null>(null)
  const [empChoisi, setEmpChoisi] = useState<string>('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok'|'error'|'info'>('info')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<ScanEntry[]>([])
  const [manualCode, setManualCode] = useState('')
  const [filterAllee, setFilterAllee] = useState('')
  const [filterNiv, setFilterNiv] = useState('')
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastKeyRef = useRef(0)

  const { data: emplacementsLibres } = useQuery({
    queryKey: ['emplacements-libres'],
    queryFn: () => client.get('/emplacements/libres').then(r => r.data),
    enabled: step === 'choisir_emplacement'
  })

  const { data: articles } = useQuery({
    queryKey: ['articles'],
    queryFn: () => client.get('/articles/').then(r => r.data)
  })

  const alleesFiltrees = [...new Set(
    emplacementsLibres?.map((e: any) => e.allee) ?? []
  )].sort((a: string, b: string) => {
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b)
  }) as string[]

  const niveauxFiltres = [
    {val: '', label: 'Tous niveaux'},
    {val: '0', label: 'Sol (00)'},
    {val: '1', label: 'Niveau 1'},
    {val: '2', label: 'Niveau 2'},
    {val: '3', label: 'Niveau 3'},
  ]

  const empFiltres = emplacementsLibres?.filter((e: any) => {
    if (filterAllee && e.allee !== filterAllee) return false
    if (filterNiv !== '' && e.niveau !== parseInt(filterNiv)) return false
    return true
  }) ?? []

  const handleScan = useCallback((raw: string) => {
    if (raw.length < 3) return
    const data = parseEAN128(raw.trim())
    setScanData(data)
    setStep('choisir_emplacement')
    setEmpChoisi('')
    setMessage('')

    const article = articles?.find((a: any) =>
      a.reference === data.ref ||
      a.code_ean13 === data.ref ||
      a.code_gtin14 === data.ref
    )
    if (!article) {
      setMessage(`Article ${data.ref} non trouve en base — verifiez la reference`)
      setMessageType('error')
    } else {
      setMessage(`Article identifie : ${article.designation}`)
      setMessageType('info')
    }
  }, [articles])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now()
      if (now - lastKeyRef.current > 80) bufferRef.current = ''
      lastKeyRef.current = now
      if (e.key === 'Enter') {
        clearTimeout(timerRef.current)
        handleScan(bufferRef.current)
        bufferRef.current = ''
        return
      }
      if (e.key.length === 1) bufferRef.current += e.key
      timerRef.current = setTimeout(() => {
        handleScan(bufferRef.current)
        bufferRef.current = ''
      }, 250)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleScan])

  const choisirEmplacement = (code: string) => {
    setEmpChoisi(code)
    setStep('confirmer')
  }

  const validerReception = async () => {
    if (!scanData || !empChoisi) return
    setLoading(true)
    try {
      const lotNum = scanData.lot ||
        `LOT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*100).toString().padStart(2,'0')}`

      const res = await client.post('/emplacements/affecter', {
        code_emplacement: empChoisi,
        numero_lot: lotNum,
        article_reference: scanData.ref,
        quantite: scanData.qty
      })

      if (res.data.error) {
        setMessage(res.data.error)
        setMessageType('error')
        setStep('erreur')
        return
      }

      await client.post('/articles/entree', {
        reference: scanData.ref,
        quantite: scanData.qty,
        numero_lot: lotNum,
        emplacement: empChoisi,
        motif: 'reception_fournisseur',
        commentaire: `Reception scan — ${scanData.raw}`
      })

      setHistory(prev => [{
        scan: scanData,
        emplacement: empChoisi,
        ts: new Date()
      }, ...prev.slice(0, 19)])

      queryClient.invalidateQueries({ queryKey: ['emplacements-libres'] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })

      setMessage(`Reception validee — ${scanData.ref} range en ${empChoisi}`)
      setMessageType('ok')
      setStep('succes')

      setTimeout(() => {
        setScanData(null)
        setEmpChoisi('')
        setMessage('')
        setStep('attente_scan')
      }, 3000)

    } catch {
      setMessage('Erreur lors de la validation')
      setMessageType('error')
      setStep('erreur')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setScanData(null)
    setEmpChoisi('')
    setMessage('')
    setStep('attente_scan')
    setFilterAllee('')
    setFilterNiv('')
  }

  const msgColor: Record<string, string> = {
    ok:    'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info:  'bg-blue-50 border-blue-200 text-blue-700',
  }

  const nivLabel: Record<number, string> = {0:'Sol', 1:'Niv 1', 2:'Niv 2', 3:'Niv 3'}

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-medium text-slate-800">Reception</h1>
        <p className="text-sm text-slate-500">Scan de palette — selection manuelle de l'emplacement</p>
      </div>

      <div className={`flex items-center gap-3 p-3 rounded-lg border mb-4 text-sm ${
        step === 'attente_scan'       ? 'bg-green-50 border-green-200 text-green-700' :
        step === 'choisir_emplacement'? 'bg-blue-50 border-blue-200 text-blue-700' :
        step === 'confirmer'          ? 'bg-amber-50 border-amber-200 text-amber-700' :
        step === 'succes'             ? 'bg-green-50 border-green-200 text-green-700' :
                                        'bg-red-50 border-red-200 text-red-700'
      }`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          step === 'attente_scan'        ? 'bg-green-500 animate-pulse' :
          step === 'choisir_emplacement' ? 'bg-blue-500 animate-pulse' :
          step === 'confirmer'           ? 'bg-amber-500 animate-pulse' :
          step === 'succes'              ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <span className="font-medium flex-1">
          {step === 'attente_scan'        && 'Douchette active — scannez une palette'}
          {step === 'choisir_emplacement' && 'Choisissez un emplacement de rangement'}
          {step === 'confirmer'           && `Confirmer rangement en ${empChoisi} ?`}
          {step === 'succes'              && 'Reception validee !'}
          {step === 'erreur'              && 'Erreur — recommencez'}
        </span>
        {(step !== 'attente_scan' && step !== 'succes') && (
          <button onClick={reset} className="text-xs underline font-medium">
            Annuler
          </button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg border mb-4 text-sm ${msgColor[messageType]}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">

        <div className="space-y-4">

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100">
              Simulation scan manuel
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { handleScan(manualCode); setManualCode('') }}}
                placeholder="(01)03700123456789(10)LOT-001(37)0240"
                className="flex-1 border border-slate-200 rounded px-3 py-2 text-xs font-mono"
              />
              <button
                onClick={() => { handleScan(manualCode); setManualCode('') }}
                className="px-3 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700"
              >
                Scanner
              </button>
            </div>
          </div>

          {scanData && (
            <div className="bg-white rounded-lg border border-blue-200 p-4">
              <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100 text-blue-700">
                Palette scannee
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Reference</div>
                  <div className="font-mono font-medium">{scanData.ref}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Quantite</div>
                  <div className="font-medium text-blue-600">{scanData.qty} u.</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">N° Lot</div>
                  <div className="font-mono text-sm">{scanData.lot || 'Auto-genere'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Date</div>
                  <div className="font-medium">{scanData.ts.toLocaleTimeString()}</div>
                </div>
                {scanData.sscc && (
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500">SSCC palette</div>
                    <div className="font-mono text-xs">{scanData.sscc}</div>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-400 font-mono break-all">{scanData.raw}</div>
              </div>
            </div>
          )}

          {empChoisi && (
            <div className="bg-white rounded-lg border border-amber-200 p-4">
              <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100 text-amber-700">
                Emplacement choisi
              </h2>
              <div className="text-center py-2">
                <div className="text-3xl font-bold text-amber-700 font-mono">{empChoisi}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Allee {empChoisi.split('-')[0]} —
                  Position {empChoisi.split('-')[1]} —
                  {' '}{nivLabel[parseInt(empChoisi.split('-')[2] ?? '0')]}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={validerReception}
                  disabled={loading}
                  className="flex-1 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-40 font-medium"
                >
                  {loading ? 'Validation...' : 'Confirmer rangement'}
                </button>
                <button
                  onClick={() => { setEmpChoisi(''); setStep('choisir_emplacement') }}
                  className="px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50"
                >
                  Changer
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100">
              Historique session ({history.length})
            </h2>
            {history.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Aucune reception ce session</p>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="font-mono font-medium text-slate-700">{h.scan.ref}</span>
                    <span className="ml-2 text-slate-500">{h.scan.qty} u.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue-600 font-medium">{h.emplacement}</span>
                    <span className="text-slate-400">{h.ts.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h2 className="text-sm font-medium">
              Emplacements libres
              {emplacementsLibres && (
                <span className="ml-2 text-xs text-slate-500">({empFiltres.length} / {emplacementsLibres.length})</span>
              )}
            </h2>
          </div>

          {step !== 'choisir_emplacement' && step !== 'confirmer' ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-3xl mb-2">&#x1F4E6;</div>
              <p className="text-sm">Scannez une palette pour voir les emplacements disponibles</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-3 flex-wrap">
                <select
                  value={filterAllee}
                  onChange={e => setFilterAllee(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs"
                >
                  <option value="">Toutes allee</option>
                  {alleesFiltrees.map(a => (
                    <option key={a} value={a}>Allee {a}</option>
                  ))}
                </select>
                <select
                  value={filterNiv}
                  onChange={e => setFilterNiv(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs"
                >
                  {niveauxFiltres.map(n => (
                    <option key={n.val} value={n.val}>{n.label}</option>
                  ))}
                </select>
                {(filterAllee || filterNiv) && (
                  <button
                    onClick={() => { setFilterAllee(''); setFilterNiv('') }}
                    className="text-xs text-slate-500 underline"
                  >
                    Effacer filtres
                  </button>
                )}
              </div>

              {empFiltres.length === 0 ? (
                <div className="text-center py-8 text-red-600 text-sm">
                  Aucun emplacement libre avec ces filtres
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-96 overflow-y-auto">
                  {empFiltres.map((e: any) => (
                    <button
                      key={e.id}
                      onClick={() => choisirEmplacement(e.code)}
                      className={`p-2 rounded-lg border-2 text-center transition-all hover:scale-105 hover:shadow-md ${
                        empChoisi === e.code
                          ? 'bg-amber-100 border-amber-400'
                          : 'bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-500'
                      }`}
                    >
                      <div className="text-xs font-bold text-green-800">{e.code}</div>
                      <div className="text-xs text-green-600">{nivLabel[e.niveau]}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
