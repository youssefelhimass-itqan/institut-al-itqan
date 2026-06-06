'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types (inchangés) ─────────────────────────────────────────────────────
type Annonce  = { id: string; titre: string; contenu: string; priorite: string; created_at: string }
type Horaire  = { id: string; cours: string; horaire: string; jour: string; niveau: string }
type Document = { id: string; nom: string; storage_path: string; taille: string; created_at: string }
type Groupe   = { id: string; categorie: string; jour: string; horaire: string; ordre: number }
type GDoc     = { id: string; groupe_id: string; nom: string; storage_path: string; taille: string; type_doc: string; created_at: string }

type Props = {
  annoncesInit:  Annonce[]
  horairesInit:  Horaire[]
  documentsInit: Document[]
}

const CAT_LABEL: Record<string, string> = {
  coran: 'Coran (Enfants & Adultes)', 'al-itqan': 'Arabe et Religion (Enfants)', arabe: 'Arabe (Adultes)',
}

// ─── Composant ─────────────────────────────────────────────────────────────
export default function AdminDashboard({ annoncesInit, horairesInit, documentsInit }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const [tab,    setTab]    = useState<string>('annonces')
  const [saving, setSaving] = useState<boolean>(false)
  const [toast,  setToast]  = useState<string>('')

  const [annonces,  setAnnonces]  = useState<Annonce[]>(annoncesInit)
  const [horaires,  setHoraires]  = useState<Horaire[]>(horairesInit)
  const [documents, setDocuments] = useState<Document[]>(documentsInit)
  const [groupes,   setGroupes]   = useState<Groupe[]>([])
  const [groupeDocs,setGroupeDocs]= useState<Record<string, GDoc[]>>({})
  const [selGroupe, setSelGroupe] = useState<string>('')

  const [newAnn,    setNewAnn]    = useState({ titre: '', contenu: '', priorite: 'normale' })
  const [newHor,    setNewHor]    = useState({ cours: '', horaire: '', jour: 'Samedi', niveau: '' })
  const [newDocNom, setNewDocNom] = useState('')
  const [uploadProg,setUploadProg]= useState('')
  const [gDocNom,   setGDocNom]   = useState('')
  const [gDocType,  setGDocType]  = useState('document')

  const fileRef  = useRef<HTMLInputElement>(null)
  const gFileRef = useRef<HTMLInputElement>(null)

  // Logique inchangée ────────────────────────────────────────────────────────
  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }
  const logout = async () => { await supabase.auth.signOut(); router.push('/'); router.refresh() }

  useEffect(() => { if (tab === 'groupes') loadGroupes() }, [tab])

  const loadGroupes = async () => {
    const { data } = await supabase.from('groupes').select('*').order('ordre')
    if (data && data.length > 0) {
      setGroupes(data); const first = data[0].id
      setSelGroupe(prev => prev || first); await loadGroupeDocs(first)
    }
  }
  const loadGroupeDocs = async (gid: string) => {
    const { data } = await supabase.from('groupe_documents').select('*')
      .eq('groupe_id', gid).order('created_at', { ascending: false })
    setGroupeDocs(prev => ({ ...prev, [gid]: data ?? [] }))
  }
  const handleSelectGroupe = async (gid: string) => {
    setSelGroupe(gid); if (!groupeDocs[gid]) await loadGroupeDocs(gid)
  }
  const addAnnonce = async () => {
    if (!newAnn.titre.trim()) return; setSaving(true)
    const { data, error } = await supabase.from('annonces').insert([newAnn]).select().single()
    if (!error && data) { setAnnonces(p => [data, ...p]); setNewAnn({ titre: '', contenu: '', priorite: 'normale' }); notify('✅ Annonce publiée !') }
    else notify('❌ ' + (error?.message ?? 'Erreur')); setSaving(false)
  }
  const delAnnonce = async (id: string) => {
    const { error } = await supabase.from('annonces').delete().eq('id', id)
    if (!error) { setAnnonces(p => p.filter(a => a.id !== id)); notify('🗑️ Supprimée.') }
    else notify('❌ ' + error.message)
  }
  const addHoraire = async () => {
    if (!newHor.cours.trim()) return; setSaving(true)
    const { data, error } = await supabase.from('horaires').insert([newHor]).select().single()
    if (!error && data) { setHoraires(p => [...p, data]); setNewHor({ cours: '', horaire: '', jour: 'Samedi', niveau: '' }); notify('✅ Horaire ajouté !') }
    else notify('❌ ' + (error?.message ?? 'Erreur')); setSaving(false)
  }
  const delHoraire = async (id: string) => {
    const { error } = await supabase.from('horaires').delete().eq('id', id)
    if (!error) { setHoraires(p => p.filter(h => h.id !== id)); notify('🗑️ Supprimé.') }
    else notify('❌ ' + error.message)
  }
  const uploadDoc = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { notify('⚠️ Sélectionnez un fichier.'); return }
    if (file.type !== 'application/pdf') { notify('⚠️ PDF uniquement.'); return }
    if (file.size > 20 * 1024 * 1024) { notify('⚠️ Max 20 Mo.'); return }
    setSaving(true); setUploadProg('Envoi…')
    const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`
    const { error: ue } = await supabase.storage.from('documents').upload(path, file, { contentType: 'application/pdf' })
    if (ue) { notify('❌ ' + ue.message); setSaving(false); setUploadProg(''); return }
    setUploadProg('Enregistrement…')
    const taille = file.size > 1048576 ? `${(file.size/1048576).toFixed(1)} Mo` : `${Math.round(file.size/1024)} Ko`
    const { data, error: de } = await supabase.from('documents').insert([{ nom: newDocNom.trim() || file.name, storage_path: path, taille }]).select().single()
    if (de) { await supabase.storage.from('documents').remove([path]); notify('❌ ' + de.message) }
    else if (data) { setDocuments(p => [data, ...p]); setNewDocNom(''); if (fileRef.current) fileRef.current.value = ''; notify('✅ Document ajouté !') }
    setSaving(false); setUploadProg('')
  }
  const delDoc = async (doc: Document) => {
    await supabase.storage.from('documents').remove([doc.storage_path])
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (!error) { setDocuments(p => p.filter(d => d.id !== doc.id)); notify('🗑️ Supprimé.') }
    else notify('❌ ' + error.message)
  }
  const uploadGDoc = async () => {
    if (!selGroupe) { notify('⚠️ Sélectionnez un groupe.'); return }
    const file = gFileRef.current?.files?.[0]
    if (!file) { notify('⚠️ Sélectionnez un fichier.'); return }
    setSaving(true)
    const path = `${selGroupe}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`
    const { error: ue } = await supabase.storage.from('groupe-docs').upload(path, file)
    if (ue) { notify('❌ ' + ue.message); setSaving(false); return }
    const taille = file.size > 1048576 ? `${(file.size/1048576).toFixed(1)} Mo` : `${Math.round(file.size/1024)} Ko`
    const { data, error: de } = await supabase.from('groupe_documents').insert([{ groupe_id: selGroupe, nom: gDocNom.trim() || file.name, storage_path: path, taille, type_doc: gDocType }]).select().single()
    if (de) { await supabase.storage.from('groupe-docs').remove([path]); notify('❌ ' + de.message) }
    else if (data) { setGroupeDocs(p => ({ ...p, [selGroupe]: [data, ...(p[selGroupe] ?? [])] })); setGDocNom(''); setGDocType('document'); if (gFileRef.current) gFileRef.current.value = ''; notify('✅ Document ajouté au groupe !') }
    setSaving(false)
  }
  const delGDoc = async (gd: GDoc) => {
    await supabase.storage.from('groupe-docs').remove([gd.storage_path])
    const { error } = await supabase.from('groupe_documents').delete().eq('id', gd.id)
    if (!error) { setGroupeDocs(p => ({ ...p, [gd.groupe_id]: (p[gd.groupe_id] ?? []).filter(d => d.id !== gd.id) })); notify('🗑️ Supprimé.') }
    else notify('❌ ' + error.message)
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'annonces',  icon: '📢', label: 'Annonces'  },
    { id: 'horaires',  icon: '🕐', label: 'Horaires'  },
    { id: 'documents', icon: '📄', label: 'Documents' },
    { id: 'groupes',   icon: '👥', label: 'Groupes'   },
  ]

  return (
    <div className="min-h-screen">

      {/* Toast premium */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl text-sm font-semibold animate-fade-up"
          style={{ background: '#FFFFFF', border: '1px solid rgba(139,96,32,0.20)', color: 'var(--text-1)', boxShadow: '0 12px 40px rgba(44,26,6,0.18)' }}>
          {toast}
        </div>
      )}

      {/* ══════════ HEADER ══════════ */}
      <header className="sticky top-0 z-40"
        style={{
          background: 'rgba(90,12,28,0.96)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          borderBottom: '1px solid rgba(139,96,32,0.25)',
        }}>
        <div className="flex items-center h-[60px] px-8">
          <div className="shrink-0">
            <p className="text-[15px] font-semibold leading-none tracking-tight" style={{ color: 'var(--text-1)' }}>
              Institut Al-Itqan
            </p>
            <p className="text-[11px] font-medium leading-none mt-[5px] tracking-widest uppercase" style={{ color: 'var(--gold)' }}>
              Administration
            </p>
          </div>
          <div className="flex-1" />
          <button onClick={logout}
            className="text-[13px] font-medium transition-all duration-200 px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLElement; b.style.color = 'var(--text-1)'; b.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLElement; b.style.color = 'var(--text-2)'; b.style.background = 'transparent' }}>
            Déconnexion
          </button>
        </div>

        {/* Onglets */}
        <div className="overflow-x-auto" style={{ borderTop: '1px solid rgba(139,96,32,0.18)' }}>
          <div className="flex px-5">
            {TABS.map(item => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className="flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 relative"
                style={{ color: tab === item.id ? '#8B1A2F' : 'var(--text-2)', background: 'transparent' }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {/* Underline animé */}
                {tab === item.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ background: '#8B6020' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══════════ CONTENU ══════════ */}
      <main className="max-w-3xl mx-auto px-5 py-10 space-y-5">

        {/* ──── ANNONCES ──── */}
        {tab === 'annonces' && (
          <>
            {/* Formulaire */}
            <div className="glass rounded-2xl p-6 animate-fade-up">
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--gold)' }}>
                Nouvelle annonce
              </p>
              <div className="space-y-3">
                <input className="inp-premium" placeholder="Titre de l'annonce *"
                  value={newAnn.titre} onChange={e => setNewAnn(p => ({ ...p, titre: e.target.value }))} />
                <textarea className="inp-premium resize-none" rows={3} placeholder="Contenu de l'annonce…"
                  value={newAnn.contenu} onChange={e => setNewAnn(p => ({ ...p, contenu: e.target.value }))} />
                <div className="flex gap-3">
                  <select className="inp-premium flex-1"
                    value={newAnn.priorite} onChange={e => setNewAnn(p => ({ ...p, priorite: e.target.value }))}>
                    <option value="normale">📗 Normale</option>
                    <option value="moyenne">📙 Importante</option>
                    <option value="haute">📕 Urgente</option>
                  </select>
                  <button onClick={addAnnonce} disabled={saving}
                    className="btn-primary px-6 py-2.5 rounded-xl text-sm disabled:opacity-40">
                    + Publier
                  </button>
                </div>
              </div>
            </div>

            {/* Liste */}
            <div className="glass rounded-2xl p-6 animate-fade-up delay-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
                Publiées ({annonces.length})
              </p>
              {!annonces.length && (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>Aucune annonce.</p>
              )}
              <div className="space-y-2">
                {annonces.map(a => (
                  <div key={a.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-150"
                    style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(139,96,32,0.12)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{a.titre}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>{a.contenu}</p>
                    </div>
                    <span className="badge text-xs shrink-0" style={{
                      background: a.priorite === 'haute' ? 'rgba(248,113,113,0.12)' : a.priorite === 'moyenne' ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)',
                      color: a.priorite === 'haute' ? '#F87171' : a.priorite === 'moyenne' ? '#FBBF24' : '#34D399',
                    }}>
                      {a.priorite === 'haute' ? 'Urgent' : a.priorite === 'moyenne' ? 'Important' : 'Info'}
                    </span>
                    <button onClick={() => delAnnonce(a.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0"
                      style={{ background: 'rgba(139,96,32,0.12)', color: '#8B6020' }}>
                      Suppr.
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ──── HORAIRES ──── */}
        {tab === 'horaires' && (
          <>
            <div className="glass rounded-2xl p-6 animate-fade-up">
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--gold)' }}>
                Ajouter un cours
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input className="inp-premium" placeholder="Nom du cours *"
                  value={newHor.cours} onChange={e => setNewHor(p => ({ ...p, cours: e.target.value }))} />
                <input className="inp-premium" placeholder="Horaire (ex: 09h–11h)"
                  value={newHor.horaire} onChange={e => setNewHor(p => ({ ...p, horaire: e.target.value }))} />
                <input className="inp-premium" placeholder="Niveau"
                  value={newHor.niveau} onChange={e => setNewHor(p => ({ ...p, niveau: e.target.value }))} />
                <select className="inp-premium" value={newHor.jour}
                  onChange={e => setNewHor(p => ({ ...p, jour: e.target.value }))}>
                  {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map(j => <option key={j}>{j}</option>)}
                </select>
              </div>
              <button onClick={addHoraire} disabled={saving}
                className="btn-primary mt-4 px-6 py-2.5 rounded-xl text-sm disabled:opacity-40">
                + Ajouter le cours
              </button>
            </div>

            <div className="glass rounded-2xl p-6 animate-fade-up delay-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
                Horaires ({horaires.length})
              </p>
              {!horaires.length && <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>Aucun horaire.</p>}
              <div className="space-y-2">
                {horaires.map(h => (
                  <div key={h.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(139,96,32,0.12)' }}>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{h.cours}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{h.jour} · {h.horaire} · {h.niveau}</p>
                    </div>
                    <button onClick={() => delHoraire(h.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0"
                      style={{ background: 'rgba(139,96,32,0.12)', color: '#8B6020' }}>
                      Suppr.
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ──── DOCUMENTS ──── */}
        {tab === 'documents' && (
          <>
            <div className="glass rounded-2xl p-6 animate-fade-up">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
                Ajouter un document PDF
              </p>
              <p className="text-xs mb-5" style={{ color: 'var(--text-3)' }}>Documents généraux — calendrier, règlement, etc.</p>
              <div className="space-y-3">
                <input className="inp-premium" placeholder="Nom affiché (optionnel)"
                  value={newDocNom} onChange={e => setNewDocNom(e.target.value)} />
                <div className="rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--border)' }}>
                  <span style={{ color: 'var(--text-3)' }}>📎</span>
                  <input ref={fileRef} type="file" accept="application/pdf"
                    className="flex-1 text-sm cursor-pointer"
                    style={{ color: 'var(--text-2)', background: 'transparent', border: 'none', outline: 'none' }} />
                </div>
                {uploadProg && (
                  <p className="text-sm font-medium" style={{ color: 'var(--gold)' }}>{uploadProg}</p>
                )}
                <button onClick={uploadDoc} disabled={saving}
                  className="btn-primary w-full py-3 rounded-xl text-sm disabled:opacity-40">
                  {saving ? 'Envoi en cours…' : '↑ Uploader le PDF'}
                </button>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 animate-fade-up delay-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
                Documents publiés ({documents.length})
              </p>
              {!documents.length && <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>Aucun document.</p>}
              <div className="space-y-2">
                {documents.map(d => (
                  <div key={d.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(139,96,32,0.12)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'var(--accent-soft)', color: 'var(--gold)' }}>PDF</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{d.nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{d.taille}</p>
                    </div>
                    <button onClick={() => delDoc(d)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                      style={{ background: 'rgba(139,96,32,0.12)', color: '#8B6020' }}>
                      Suppr.
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ──── GROUPES ──── */}
        {tab === 'groupes' && (
          <>
            <div className="glass rounded-2xl p-6 animate-fade-up">
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--gold)' }}>
                Ajouter un document à un groupe
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-3)' }}>Groupe *</label>
                  <select className="inp-premium" value={selGroupe} onChange={e => handleSelectGroupe(e.target.value)}>
                    {(['coran','al-itqan','arabe'] as const).map(cat => (
                      <optgroup key={cat} label={CAT_LABEL[cat]}>
                        {groupes.filter(g => g.categorie === cat).map(g => (
                          <option key={g.id} value={g.id}>{g.jour} · {g.horaire}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-3)' }}>Type</label>
                    <select className="inp-premium" value={gDocType} onChange={e => setGDocType(e.target.value)}>
                      <option value="document">📄 Document</option>
                      <option value="cours">📖 Cours</option>
                      <option value="devoir">📝 Devoir</option>
                      <option value="rappel">🔔 Rappel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-3)' }}>Nom (optionnel)</label>
                    <input className="inp-premium" placeholder="Nom du fichier"
                      value={gDocNom} onChange={e => setGDocNom(e.target.value)} />
                  </div>
                </div>

                <div className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--border)' }}>
                  <span style={{ color: 'var(--text-3)' }}>📎</span>
                  <input ref={gFileRef} type="file" className="flex-1 text-sm cursor-pointer"
                    style={{ color: 'var(--text-2)', background: 'transparent', border: 'none', outline: 'none' }} />
                </div>

                <button onClick={uploadGDoc} disabled={saving}
                  className="btn-primary w-full py-3 rounded-xl text-sm disabled:opacity-40">
                  {saving ? 'Envoi…' : '↑ Ajouter au groupe'}
                </button>
              </div>
            </div>

            {selGroupe && (
              <div className="glass rounded-2xl p-6 animate-fade-up delay-1">
                {(() => {
                  const g = groupes.find(g => g.id === selGroupe)
                  return <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
                    Documents — {g?.jour} · {g?.horaire} ({(groupeDocs[selGroupe] ?? []).length})
                  </p>
                })()}
                {!(groupeDocs[selGroupe]?.length) && (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>Aucun document dans ce groupe.</p>
                )}
                <div className="space-y-2">
                  {(groupeDocs[selGroupe] ?? []).map(gd => (
                    <div key={gd.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(139,96,32,0.12)' }}>
                      <span className="text-xl shrink-0">
                        {gd.type_doc === 'devoir' ? '📝' : gd.type_doc === 'cours' ? '📖' : gd.type_doc === 'rappel' ? '🔔' : '📄'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{gd.nom}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{gd.type_doc} · {gd.taille}</p>
                      </div>
                      <button onClick={() => delGDoc(gd)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                        style={{ background: 'rgba(139,96,32,0.12)', color: '#8B6020' }}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass rounded-2xl p-6 animate-fade-up delay-2">
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--text-3)' }}>
                Tous les groupes
              </p>
              {(['coran','al-itqan','arabe'] as const).map(cat => {
                const gs = groupes.filter(g => g.categorie === cat)
                if (!gs.length) return null
                return (
                  <div key={cat} className="mb-5 last:mb-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--gold)' }}>
                      {CAT_LABEL[cat]}
                    </p>
                    <div className="space-y-1.5">
                      {gs.map(g => (
                        <div key={g.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <p className="flex-1 text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                            {g.jour} · {g.horaire}
                          </p>
                          <button onClick={() => handleSelectGroupe(g.id)}
                            className="text-xs font-bold transition-colors"
                            style={{ color: 'var(--gold)' }}>
                            Gérer →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
