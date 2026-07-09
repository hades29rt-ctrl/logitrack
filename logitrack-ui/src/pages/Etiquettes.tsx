import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

const MODELES = [
  { id: 'ZT410', label: 'Zebra ZT410/ZT420', desc: 'Industriel — 203/300 dpi', dims: '100×150mm' },
  { id: 'ZD420', label: 'Zebra ZD420/ZD620', desc: 'Bureau — 203 dpi', dims: '100×150mm' },
  { id: 'GK420', label: 'Zebra GK420d/GX420d', desc: 'Entree de gamme — 203 dpi', dims: '100×150mm' },
]

export default function Etiquettes() {
  const [onglet, setOnglet] = useState<'reception' | 'expedition'>('reception')
  const [modele, setModele] = useState('ZT410')
  const [printerIp, setPrinterIp] = useState('192.168.1.100')
  const [printerPort, setPrinterPort] = useState('9100')
  const [zplPreview, setZplPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error' | 'info'>('info')

  const [formReception, setFormReception] = useState({
    article_ref: '',
    designation: '',
    numero_lot: '',
    quantite: '',
    unite: 'piece',
    emplacement: ''
  })

  const [formExpedition, setFormExpedition] = useState({
    article_ref: '',
    designation: '',
    numero_lot: '',
    quantite: '',
    unite: 'piece',
    emplacement: '',
    client_nom: '',
    client_adresse: '',
    client_cp: '',
    client_ville: '',
    numero_cmd: ''
  })

  const { data: articles } = useQuery({
    queryKey: ['articles'],
    queryFn: () => client.get('/articles/').then(r => r.data)
  })

  const { data: clients_list } = useQuery({
    queryKey: ['clients'],
    queryFn: () => client.get('/clients/').then(r => r.data)
  })

  const handleArticleChange = (ref: string, form: any, setForm: any) => {
    const article = articles?.find((a: any) => a.reference === ref)
    setForm({ ...form, article_ref: ref, designation: article?.designation ?? '', unite: article?.unite ?? 'piece' })
  }

  const handleClientChange = (id: string) => {
    const c = clients_list?.find((c: any) => c.id === parseInt(id))
    if (c) {
      setFormExpedition({
        ...formExpedition,
        client_nom: c.raison_sociale,
        client_adresse: c.adresse ?? '',
        client_cp: c.code_postal ?? '',
        client_ville: c.ville ?? ''
      })
    }
  }

  const genererPreview = async () => {
    setLoading(true)
    try {
      const res = await client.get(`/etiquettes/preview/${onglet}?modele=${modele}`)
      setZplPreview(res.data)
      setMessage('ZPL genere — verifiez l\'apercu ci-dessous')
      setMessageType('info')
    } catch {
      setMessage('Erreur de generation')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const genererEtiquette = async () => {
    setLoading(true)
    setMessage('')
    try {
      let res
      if (onglet === 'reception') {
        res = await client.post('/etiquettes/reception', {
          ...formReception,
          quantite: parseInt(formReception.quantite) || 0,
          modele
        })
      } else {
        res = await client.post('/etiquettes/expedition', {
          ...formExpedition,
          quantite: parseInt(formExpedition.quantite) || 0,
          modele
        })
      }
      setZplPreview(res.data)
      setMessage('ZPL genere — copiez le code ou envoyez a l\'imprimante')
      setMessageType('ok')
    } catch {
      setMessage('Erreur de generation')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const envoyerImprimante = async () => {
    if (!zplPreview) { setMessage('Generez d\'abord une etiquette'); setMessageType('error'); return }
    setMessage(`Envoi vers ${printerIp}:${printerPort} — connectez votre imprimante Zebra au reseau`)
    setMessageType('info')
  }

  const copierZPL = () => {
    navigator.clipboard.writeText(zplPreview)
    setMessage('ZPL copie dans le presse-papier !')
    setMessageType('ok')
  }

  const msgColor: Record<string, string> = {
    ok:    'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info:  'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg md:text-xl font-medium text-slate-800">Etiquettes EAN-128</h1>
        <p className="text-sm text-slate-500">Generation ZPL pour imprimantes Zebra — format 100×150mm</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border mb-4 text-sm ${msgColor[messageType]}`}>{message}</div>
      )}

      <div className="flex flex-col lg:grid gap-4 md:gap-6" style={{gridTemplateColumns: '2fr 3fr'}}>

        <div className="space-y-4">

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100">Modele imprimante</h2>
            <div className="space-y-2">
              {MODELES.map(m => (
                <div key={m.id}
                  onClick={() => setModele(m.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    modele === m.id
                      ? 'border-slate-800 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{m.label}</div>
                      <div className="text-xs text-slate-500">{m.desc}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">{m.dims}</div>
                      {modele === m.id && (
                        <div className="text-xs text-slate-800 font-medium">✓ Selectionne</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100">Imprimante reseau</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Adresse IP</label>
                <input type="text" value={printerIp} onChange={e => setPrinterIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Port</label>
                <input type="text" value={printerPort} onChange={e => setPrinterPort(e.target.value)}
                  placeholder="9100"
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Port 9100 = port RAW Zebra standard
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex gap-2 mb-4">
              <button onClick={() => setOnglet('reception')}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  onglet === 'reception' ? 'bg-slate-800 text-white' : 'border border-slate-200 hover:bg-slate-50'
                }`}>
                Reception
              </button>
              <button onClick={() => setOnglet('expedition')}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  onglet === 'expedition' ? 'bg-slate-800 text-white' : 'border border-slate-200 hover:bg-slate-50'
                }`}>
                Expedition
              </button>
            </div>

            {onglet === 'reception' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Article</label>
                    <select value={formReception.article_ref}
                      onChange={e => handleArticleChange(e.target.value, formReception, setFormReception)}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                      <option value="">Selectionner...</option>
                      {articles?.map((a: any) => (
                        <option key={a.id} value={a.reference}>{a.reference}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Unite</label>
                    <input type="text" value={formReception.unite}
                      onChange={e => setFormReception({ ...formReception, unite: e.target.value })}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Designation</label>
                  <input type="text" value={formReception.designation}
                    onChange={e => setFormReception({ ...formReception, designation: e.target.value })}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">N° Lot</label>
                    <input type="text" value={formReception.numero_lot}
                      onChange={e => setFormReception({ ...formReception, numero_lot: e.target.value })}
                      placeholder="LOT-YYYYMMDD-XX"
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Quantite</label>
                    <input type="number" value={formReception.quantite}
                      onChange={e => setFormReception({ ...formReception, quantite: e.target.value })}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Client</label>
                  <select onChange={e => handleClientChange(e.target.value)}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                    <option value="">Selectionner un client...</option>
                    {clients_list?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.raison_sociale}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Article</label>
                    <select value={formExpedition.article_ref}
                      onChange={e => handleArticleChange(e.target.value, formExpedition, setFormExpedition)}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm">
                      <option value="">Selectionner...</option>
                      {articles?.map((a: any) => (
                        <option key={a.id} value={a.reference}>{a.reference}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Quantite</label>
                    <input type="number" value={formExpedition.quantite}
                      onChange={e => setFormExpedition({ ...formExpedition, quantite: e.target.value })}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">N° Lot</label>
                    <input type="text" value={formExpedition.numero_lot}
                      onChange={e => setFormExpedition({ ...formExpedition, numero_lot: e.target.value })}
                      placeholder="LOT-YYYYMMDD-XX"
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">N° CMD</label>
                    <input type="text" value={formExpedition.numero_cmd}
                      onChange={e => setFormExpedition({ ...formExpedition, numero_cmd: e.target.value })}
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={genererEtiquette} disabled={loading}
                className="flex-1 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40 font-medium">
                {loading ? 'Generation...' : 'Generer etiquette'}
              </button>
              <button onClick={genererPreview} disabled={loading}
                className="px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50">
                Apercu
              </button>
            </div>
          </div>

        </div>

        <div className="space-y-4">

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h2 className="text-sm font-medium">Code ZPL genere</h2>
              <div className="flex gap-2">
                <button onClick={copierZPL} disabled={!zplPreview}
                  className="px-3 py-1 border border-slate-200 rounded text-xs hover:bg-slate-50 disabled:opacity-40">
                  Copier ZPL
                </button>
                <button onClick={envoyerImprimante} disabled={!zplPreview}
                  className="px-3 py-1 bg-slate-800 text-white rounded text-xs hover:bg-slate-700 disabled:opacity-40">
                  Envoyer imprimante
                </button>
              </div>
            </div>

            {zplPreview ? (
              <textarea
                value={zplPreview}
                readOnly
                rows={20}
                className="w-full border border-slate-200 rounded px-3 py-2 text-xs font-mono bg-slate-50"
              />
            ) : (
              <div className="text-center py-12 text-slate-400">
                <div className="text-3xl mb-2">🏷️</div>
                <p className="text-sm">Remplissez le formulaire et cliquez</p>
                <p className="text-sm">"Generer etiquette"</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-medium mb-3 pb-2 border-b border-slate-100">
              Comment imprimer
            </h2>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex gap-2">
                <span className="font-medium text-slate-800 w-4">1.</span>
                <span>Generez le code ZPL en remplissant le formulaire</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-slate-800 w-4">2.</span>
                <span><strong>Option A</strong> — Copiez le ZPL et collez-le dans Zebra Designer ou ZPL viewer</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-slate-800 w-4"> </span>
                <span><strong>Option B</strong> — Envoyez directement via le port RAW 9100 (imprimante en reseau)</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-slate-800 w-4"> </span>
                <span><strong>Option C</strong> — Utilisez <a href="https://labelary.com/viewer.html" target="_blank" rel="noreferrer" className="text-blue-600 underline">labelary.com</a> pour previsualiser le ZPL</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-slate-800 w-4">3.</span>
                <span>Une fois le modele choisi, configurez l'IP de l'imprimante dans la section "Imprimante reseau"</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
