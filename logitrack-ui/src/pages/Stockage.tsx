import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

type ScanStep = 'idle' | 'attente_destination' | 'succes' | 'erreur'

const NIVEAUX = [3, 2, 1, 0]
const NIV_LABELS: Record<number, string> = { 0: 'Sol', 1: 'Niv 1', 2: 'Niv 2', 3: 'Niv 3' }

export default function Stockage() {
  const queryClient = useQueryClient()
  const [allee, setAllee] = useState('A')
  const [scanStep, setScanStep] = useState<ScanStep>('idle')
  const [paletteSel, setPaletteSel] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error' | 'info'>('info')
  const [loading, setLoading] = useState(false)
  const [cellDetail, setCellDetail] = useState<any>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastKeyRef = useRef(0)

  const { data: emplacements, refetch } = useQuery({
    queryKey: ['emplacements'],
    queryFn: () => client.get('/emplacements/').then(r => r.data),
    refetchInterval: 10000
  })

  const allees = [...new Set(emplacements?.map((e: any) => e.allee) ?? [])].sort((a: string, b: string) => {
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b)
  }) as string[]

  const empAllee = emplacements?.filter((e: any) => e.allee === allee) ?? []
  const positions = [...new Set(empAllee.map((e: any) => e.rangee))].sort((a: number, b: number) => a - b) as number[]
  const emplacementsLibres = emplacements?.filter((e: any) => e.statut === 'libre') ?? []

  const getCell = (pos: number, niv: number) =>
    empAllee.find((e: any) => e.rangee === pos && e.niveau === niv)

  const stats = {
    total:   emplacements?.length ?? 0,
    libres:  emplacements?.filter((e: any) => e.statut === 'libre').length ?? 0,
    occupes: emplacements?.filter((e: any) => e.statut === 'occupe').length ?? 0,
  }
  const pct = stats.total > 0 ? Math.round(stats.occupes / stats.total * 100) : 0

  const doTransfert = useCallback(async (codePalette: string, codeDest: string) => {
    setLoading(true)
    try {
      const res = await client.post('/emplacements/transfert', {
        code_palette: codePalette,
        code_destination: codeDest
      })
      const data = res.data
      if (data.error) {
        if (data.type === 'emplacement_occupe') {
          setMessage(`Impossible — ${codeDest} est deja occupe. Choisissez un emplacement libre.`)
        } else {
          setMessage(data.error)
        }
        setMessageType('error')
        setScanStep('erreur')
      } else {
        setMessage(`Transfert OK — ${data.palette} : ${data.emplacement_precedent} → ${data.emplacement_destination}`)
        setMessageType('ok')
        setScanStep('succes')
        setPaletteSel(null)
        setCellDetail(null)
        queryClient.invalidateQueries({ queryKey: ['emplacements'] })
        refetch()
        setTimeout(() => { setScanStep('idle'); setMessage('') }, 3000)
      }
    } catch {
      setMessage('Erreur de communication')
      setMessageType('error')
      setScanStep('erreur')
    } finally {
      setLoading(false)
    }
  }, [queryClient, refetch])

  const handleScan = useCallback(async (raw: string) => {
    if (raw.length < 2) return
    const code = raw.trim().toUpperCase()

    if (scanStep === 'idle' || scanStep === 'succes' || scanStep === 'erreur') {
      setLoading(true)
      try {
        const res = await client.get(`/emplacements/scan/${code}`)
        const data = res.data
        if (data.error) {
          setPaletteSel({ numero_lot: code, emplacement_actuel: '?' })
          setScanStep('attente_destination')
          setMessage(`Palette ${code} — scannez ou cliquez sur un emplacement destination`)
          setMessageType('info')
        } else if (data.type === 'emplacement' && data.statut === 'occupe') {
          setPaletteSel({
            numero_lot: data.numero_lot,
            emplacement_actuel: data.code,
            article_ref: data.article_ref,
            article_designation: data.article_designation,
            quantite_lot: data.quantite_lot
          })
          setScanStep('attente_destination')
          setMessage(`Palette ${data.numero_lot} sur ${data.code} — scannez ou cliquez destination`)
          setMessageType('info')
        } else if (data.type === 'emplacement' && data.statut === 'libre') {
          setMessage(`Emplacement ${code} libre — scannez d'abord une palette`)
          setMessageType('error')
          setScanStep('erreur')
        } else {
          setMessage(`Code ${code} non reconnu`)
          setMessageType('error')
          setScanStep('erreur')
        }
      } catch {
        setMessage('Erreur de communication')
        setMessageType('error')
      } finally {
        setLoading(false)
      }
    } else if (scanStep === 'attente_destination') {
      await doTransfert(paletteSel.numero_lot, code)
    }
  }, [scanStep, paletteSel, doTransfert])

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

  const handleCellClick = (cell: any) => {
    if (!cell) return
    if (scanStep !== 'attente_destination' && cell.statut === 'occupe') {
      setPaletteSel({
        numero_lot: cell.numero_lot,
        emplacement_actuel: cell.code,
        article_ref: cell.article_ref,
        article_designation: cell.article_designation,
        quantite_lot: cell.quantite_lot
      })
      setScanStep('attente_destination')
      setMessage(`Palette ${cell.numero_lot} sur ${cell.code} — scannez ou cliquez destination`)
      setMessageType('info')
      setCellDetail(cell)
    } else if (scanStep === 'attente_destination' && cell.statut === 'libre') {
      doTransfert(paletteSel.numero_lot, cell.code)
    } else if (scanStep === 'attente_destination' && cell.statut === 'occupe') {
      setMessage(`Impossible — ${cell.code} est deja occupe. Choisissez un emplacement libre (vert).`)
      setMessageType('error')
    } else if (cell.statut === 'libre') {
      setCellDetail(cell)
    }
  }

  const cellStyle = (cell: any) => {
    if (!cell) return 'bg-slate-100 border-slate-200 opacity-30'
    const base = 'cursor-pointer transition-all hover:scale-105 hover:shadow-md '
    if (scanStep === 'attente_destination' && cell.statut === 'libre') {
      return base + 'bg-green-50 border-green-400 ring-2 ring-green-300 ring-offset-1'
    }
    switch (cell.statut) {
      case 'occupe':  return base + 'bg-blue-50 border-blue-300'
      case 'libre':   return base + 'bg-green-50 border-green-200'
      case 'reserve': return base + 'bg-amber-50 border-amber-300'
      case 'bloque':  return base + 'bg-red-50 border-red-300'
      default:        return base + 'bg-slate-50 border-slate-200'
    }
  }

  const msgColor: Record<string, string> = {
    ok:    'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info:  'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-medium text-slate-800">Plan des palettiers</h1>
        <p className="text-sm text-slate-500">Format : ALLEE-POSITION-NIVEAU — ex: A-01-00 = Allee A, position 1, sol</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-2xl font-medium text-slate-800">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Total</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-2xl font-medium text-green-600">{stats.libres.toLocaleString()}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Libres</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-2xl font-medium text-blue-600">{stats.occupes.toLocaleString()}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Occupes</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-2xl font-medium text-amber-600">{pct}%</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Taux occup.</div>
        </div>
      </div>

      <div className={`flex items-center gap-3 p-3 rounded-lg border mb-4 text-sm ${
        scanStep === 'idle'                ? 'bg-green-50 border-green-200 text-green-700' :
        scanStep === 'attente_destination' ? 'bg-blue-50 border-blue-200 text-blue-700' :
        scanStep === 'succes'              ? 'bg-green-50 border-green-200 text-green-700' :
                                             'bg-red-50 border-red-200 text-red-700'
      }`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          scanStep === 'idle'                ? 'bg-green-500 animate-pulse' :
          scanStep === 'attente_destination' ? 'bg-blue-500 animate-pulse' :
          scanStep === 'succes'              ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <span className="font-medium flex-1">
          {scanStep === 'idle'                && 'Scannez une palette ou cliquez sur un emplacement occupe (bleu)'}
          {scanStep === 'attente_destination' && 'Scannez ou cliquez sur un emplacement destination (vert)'}
          {scanStep === 'succes'              && 'Transfert effectue avec succes !'}
          {scanStep === 'erreur'              && 'Erreur — recommencez'}
        </span>
        {loading && <span className="text-xs animate-pulse">Traitement...</span>}
        {(scanStep === 'attente_destination' || scanStep === 'erreur') && (
          <button
            onClick={() => { setScanStep('idle'); setMessage(''); setPaletteSel(null); setCellDetail(null) }}
            className="text-xs underline font-medium ml-2"
          >
            Annuler
          </button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg border mb-4 text-sm ${msgColor[messageType]}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">

        {paletteSel && (
          <div className="bg-white rounded-lg border border-blue-200 p-4">
            <div className="text-xs text-blue-600 uppercase tracking-wide font-medium mb-3">Palette selectionnee</div>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500 text-xs">Lot</span><div className="font-mono font-medium">{paletteSel.numero_lot}</div></div>
              <div><span className="text-slate-500 text-xs">Emplacement actuel</span><div className="font-medium">{paletteSel.emplacement_actuel}</div></div>
              {paletteSel.article_ref && <div><span className="text-slate-500 text-xs">Article</span><div className="font-medium">{paletteSel.article_ref}</div></div>}
              {paletteSel.quantite_lot && <div><span className="text-slate-500 text-xs">Quantite</span><div className="font-medium">{paletteSel.quantite_lot} u.</div></div>}
            </div>
          </div>
        )}

        {cellDetail && !paletteSel && (
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Detail emplacement</div>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500 text-xs">Code</span><div className="font-mono font-medium">{cellDetail.code}</div></div>
              <div><span className="text-slate-500 text-xs">Statut</span>
                <div className={`font-medium ${cellDetail.statut === 'libre' ? 'text-green-600' : 'text-blue-600'}`}>
                  {cellDetail.statut === 'libre' ? 'Libre' : 'Occupe'}
                </div>
              </div>
              {cellDetail.article_ref && <div><span className="text-slate-500 text-xs">Article</span><div className="font-medium">{cellDetail.article_ref}</div></div>}
              {cellDetail.numero_lot && <div><span className="text-slate-500 text-xs">Lot</span><div className="font-mono font-medium">{cellDetail.numero_lot}</div></div>}
            </div>
          </div>
        )}

        {scanStep === 'attente_destination' && emplacementsLibres.length > 0 && (
          <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">
              Emplacements libres disponibles ({emplacementsLibres.length})
            </div>
            <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto">
              {emplacementsLibres.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => doTransfert(paletteSel.numero_lot, e.code)}
                  className="p-1.5 rounded border-2 border-green-300 bg-green-50 text-center hover:bg-green-100 hover:border-green-500 transition-all"
                >
                  <div className="text-xs font-bold text-green-800">{e.code}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm font-medium">Allee {allee}</span>
            <span className="text-xs text-slate-500 ml-2">
              {empAllee.filter((e: any) => e.statut === 'occupe').length} / {empAllee.length} emplacements occupes
            </span>
          </div>
          <div className="flex gap-1 flex-wrap max-w-lg justify-end">
            {allees.map((a: string) => (
              <button
                key={a}
                onClick={() => setAllee(a)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  allee === a ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-3 h-3 rounded border-2 bg-green-50 border-green-300"></div>Libre</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-3 h-3 rounded border-2 bg-blue-50 border-blue-300"></div>Occupe</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-3 h-3 rounded border-2 bg-amber-50 border-amber-300"></div>Reserve</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-3 h-3 rounded border-2 bg-red-50 border-red-300"></div>Bloque</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: '0', minWidth: 'max-content' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '28px', marginRight: '8px', flexShrink: 0 }}>
              {NIVEAUX.map(niv => (
                <div key={niv} style={{ height: '52px', display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {NIV_LABELS[niv]}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {positions.map(pos => (
                <div key={pos} style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: '2px', height: '20px', display: 'flex', alignItems: 'center' }}>
                    {String(pos).padStart(2, '0')}
                  </div>
                  {NIVEAUX.map(niv => {
                    const cell = getCell(pos, niv)
                    return (
                      <div
                        key={niv}
                        className={`border-2 rounded-lg ${cellStyle(cell)}`}
                        style={{ width: '56px', height: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3px' }}
                        onClick={() => cell && handleCellClick(cell)}
                        title={cell ? `${cell.code} — ${cell.statut}${cell.article_ref ? ` — ${cell.article_ref}` : ''}` : ''}
                      >
                        {cell ? (
                          <>
                            <div style={{ fontSize: '9px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                              {String(pos).padStart(2,'0')}-{String(niv).padStart(2,'0')}
                            </div>
                            {cell.statut === 'occupe' && cell.article_ref ? (
                              <>
                                <div style={{ fontSize: '9px', color: '#1e40af', fontWeight: 500, maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cell.article_ref}
                                </div>
                                <div style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cell.numero_lot}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: '9px', color: cell?.statut === 'libre' ? '#16a34a' : 'var(--color-text-secondary)' }}>
                                {cell.statut === 'libre' ? 'Libre' : cell.statut}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>—</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Taux occupation allee {allee}</span>
            <span className="font-medium text-slate-700">
              {Math.round(empAllee.filter((e: any) => e.statut === 'occupe').length / (empAllee.length || 1) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{
                width: `${Math.round(empAllee.filter((e: any) => e.statut === 'occupe').length / (empAllee.length || 1) * 100)}%`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
