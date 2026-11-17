import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2, ChevronDown,
  ClipboardList, Clock3, FileCheck2, FilePlus2, HeartPulse, Home, Info,
  LayoutDashboard, LogOut, Menu, MessageCircle, RefreshCw, Save, Settings,
  ShieldCheck, Stethoscope, Trash2, UserRound, X
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://telehealth.informatikaunimus.site/api'
const DEFAULT_IDENTITY = { nim: 'C2C023103', nama: 'Muhammad Zaenal Fikri', kelas: 'Telehealth-B' }

function readConfig() {
  try { return JSON.parse(localStorage.getItem('ruangsehat_config') || '{}') } catch { return {} }
}
function saveConfig(config) { localStorage.setItem('ruangsehat_config', JSON.stringify(config)) }
function unwrap(payload) { return payload?.data ?? payload }
function asArray(value) { return Array.isArray(value) ? value : [] }
function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}
function getErrorMessage(error) {
  if (error?.status === 401) return 'Token tidak valid atau belum terpasang. Periksa kembali token dari dosen di Pengaturan.'
  if (error?.status === 409) return 'Data ini sudah dikirim atau tidak dapat diubah pada status sekarang. Muat ulang data atau buat pengisian baru.'
  if (error?.status === 422) return error.message || 'Masih ada jawaban yang perlu diperbaiki. Periksa kolom yang ditandai.'
  return error?.message || 'Terjadi kendala saat menghubungi server. Periksa koneksi lalu coba lagi.'
}

function App() {
  const [config, setConfig] = useState(() => ({ ...DEFAULT_IDENTITY, ...readConfig() }))
  const [page, setPage] = useState('home')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [profile, setProfile] = useState(null)
  const [forms, setForms] = useState([])
  const [history, setHistory] = useState([])
  const [uts, setUts] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [result, setResult] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [activeForm, setActiveForm] = useState(null)
  const [assessmentId, setAssessmentId] = useState(null)
  const [answers, setAnswers] = useState({})
  const [sectionIndex, setSectionIndex] = useState(0)
  const [consent, setConsent] = useState(false)
  const [validation, setValidation] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)

  const token = config.token || ''
  const identity = { nim: config.nim || DEFAULT_IDENTITY.nim, nama: config.nama || DEFAULT_IDENTITY.nama, kelas: config.kelas || DEFAULT_IDENTITY.kelas }

  const api = async (path, options = {}) => {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
    let payload = {}
    try { payload = await response.json() } catch { payload = { message: 'Respons server tidak dapat dibaca.' } }
    if (!response.ok || payload?.success === false) {
      const err = new Error(payload?.message || `Permintaan gagal (${response.status})`)
      err.status = response.status
      err.payload = payload
      throw err
    }
    return payload
  }

  const showNotice = (type, message) => {
    setNotice({ type, message })
    window.setTimeout(() => setNotice(null), 5200)
  }

  const refreshHome = async () => {
    if (!token) { setPage('settings'); return }
    setLoading(true)
    try {
      const [me, formList, utsData, historyData] = await Promise.all([
        api(`/me?nim=${encodeURIComponent(identity.nim)}`),
        api('/forms'),
        api(`/uts/${encodeURIComponent(identity.nim)}`).catch(() => null),
        api(`/assessments?nim=${encodeURIComponent(identity.nim)}`).catch(() => ({ data: [] }))
      ])
      setProfile(unwrap(me))
      setForms(asArray(unwrap(formList)?.data || unwrap(formList)?.forms || unwrap(formList)))
      setUts(unwrap(utsData))
      setHistory(asArray(historyData?.data))
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (token) refreshHome(); else setPage('settings') }, []) // initial load only

  const startSetup = async (nextConfig) => {
    if (!nextConfig.token?.trim()) { showNotice('error', 'Masukkan token pasien dari dosen terlebih dahulu.'); return }
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${nextConfig.token.trim()}` }
      const response = await fetch(`${API_BASE}/me?nim=${encodeURIComponent(nextConfig.nim)}`, { headers })
      const payload = await response.json()
      if (!response.ok) {
        const err = new Error(payload?.message || 'Token tidak dapat diverifikasi.')
        err.status = response.status
        throw err
      }
      const saved = { ...nextConfig, token: nextConfig.token.trim() }
      saveConfig(saved); setConfig(saved); setProfile(unwrap(payload))
      showNotice('success', 'Koneksi berhasil. Identitas dan token tersimpan pada browser ini.')
      setPage('home')
      // Muat data awal memakai token baru (state React belum tentu terbarui pada render ini).
      const authHeaders = { Authorization: `Bearer ${saved.token}` }
      const [formRes, utsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/forms`, { headers: authHeaders }).then(r => r.json()),
        fetch(`${API_BASE}/uts/${encodeURIComponent(saved.nim)}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/assessments?nim=${encodeURIComponent(saved.nim)}`, { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }))
      ])
      const formData = formRes?.data ?? formRes
      setForms(Array.isArray(formData) ? formData : (formData?.forms || []))
      setUts(utsRes?.data ?? utsRes)
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : [])
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const openForm = async (formId) => {
    if (!token) { setPage('settings'); return }
    setLoading(true)
    try {
      const payload = await api(`/forms/${formId}`)
      setActiveForm(unwrap(payload))
      setSelected(null); setAnswers({}); setAssessmentId(null); setSectionIndex(0); setConsent(false); setValidation(null)
      setPage('instructions')
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const createDraft = async () => {
    if (!consent) return
    setLoading(true)
    try {
      const payload = await api('/assessments', { method: 'POST', body: JSON.stringify({
        form_id: activeForm?.id || activeForm?.form_id,
        persetujuan: true,
        mahasiswa: identity,
        answers: {}
      }) })
      const data = unwrap(payload)
      setAssessmentId(data?.id)
      setPage('form')
      showNotice('success', 'Draf pengisian berhasil dibuat.')
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const sections = asArray(activeForm?.sections)
  const visibleSections = useMemo(() => sections.filter(s => isVisible(s.show_if, answers)), [sections, answers])
  const currentSection = visibleSections[Math.min(sectionIndex, Math.max(0, visibleSections.length - 1))]
  const setAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }))
  const saveDraft = async (goNext = false) => {
    if (!assessmentId) return
    setLoading(true)
    try {
      await api(`/assessments/${assessmentId}`, { method: 'PATCH', body: JSON.stringify({ answers }) })
      showNotice('success', 'Draf berhasil disimpan.')
      if (goNext) setSectionIndex(i => Math.min(i + 1, visibleSections.length - 1))
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }
  const validateForm = async () => {
    setLoading(true)
    try {
      const payload = await api(`/forms/${activeForm?.id || activeForm?.form_id}/validate`, { method: 'POST', body: JSON.stringify({ nim: identity.nim, answers }) })
      setValidation(unwrap(payload))
      setPage('review')
    } catch (e) {
      setValidation(e.payload?.data || null)
      showNotice('error', getErrorMessage(e))
    } finally { setLoading(false) }
  }
  const submitAssessment = async () => {
    if (!assessmentId) return
    setLoading(true)
    try {
      await api(`/assessments/${assessmentId}`, { method: 'PATCH', body: JSON.stringify({ answers }) })
      const payload = await api(`/assessments/${assessmentId}/submit`, { method: 'POST' })
      showNotice('success', payload?.message || 'Formulir berhasil dikirim.')
      setPage('success')
      await refreshHome()
    } catch (e) {
      const errors = e.payload?.errors || e.payload?.data?.errors
      if (errors) setValidation({ valid: false, errors })
      showNotice('error', getErrorMessage(e))
    } finally { setLoading(false) }
  }

  const openRecord = async (record, destination = 'detail') => {
    const id = record?.id || record
    setLoading(true); setSelected(typeof record === 'object' ? record : { id })
    try {
      const [d, h, s] = await Promise.all([
        api(`/assessments/${id}`),
        api(`/assessments/${id}/hasil`).catch(() => null),
        api(`/assessments/${id}/status`).catch(() => null)
      ])
      setDetail(unwrap(d)); setResult(unwrap(h)); setTracking(unwrap(s))
      setPage(destination)
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const deleteDraft = async (id) => {
    if (!window.confirm('Hapus draf ini? Tindakan ini tidak dapat dibatalkan.')) return
    setLoading(true)
    try {
      await api(`/assessments/${id}`, { method: 'DELETE' })
      showNotice('success', 'Draf berhasil dihapus.')
      await refreshHome()
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const resumeDraft = async (record) => {
    setLoading(true)
    try {
      const payload = await api(`/assessments/${record.id}`)
      const data = unwrap(payload)
      const formId = data?.form_id || data?.form?.id || record?.form?.id
      const formPayload = await api(`/forms/${formId}`)
      setActiveForm(unwrap(formPayload))
      setAssessmentId(record.id)
      setAnswers(data?.answers || {})
      setSectionIndex(0); setPage('form')
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const replyClarification = async (cid, answer) => {
    if (!answer.trim()) return
    setLoading(true)
    try {
      await api(`/assessments/${selected.id}/clarifications/${cid}/reply`, { method: 'POST', body: JSON.stringify({ jawaban: answer }) })
      showNotice('success', 'Jawaban klarifikasi berhasil dikirim.')
      await openRecord(selected.id, 'tracking')
    } catch (e) { showNotice('error', getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const logout = () => {
    const next = { ...config }; delete next.token
    saveConfig(next); setConfig(next); setProfile(null); setPage('settings')
    showNotice('success', 'Token dihapus dari browser ini.')
  }

  const navItems = [
    { id: 'home', label: 'Beranda', icon: Home },
    { id: 'history', label: 'Riwayat', icon: ClipboardList },
    { id: 'uts', label: 'Status UTS', icon: FileCheck2 },
    { id: 'settings', label: 'Pengaturan', icon: Settings }
  ]
  const goNav = async (id) => {
    setMobileNav(false)
    if (id === 'home') { setPage('home'); await refreshHome() }
    else if (id === 'history') { await refreshHome(); setPage('history') }
    else if (id === 'uts') { await refreshHome(); setPage('uts') }
    else setPage(id)
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><HeartPulse size={21}/></div><div><b>RuangSehat</b><small>PORTAL TELEHEALTH</small></div></div>
      <div className="side-label">MENU UTAMA</div>
      <nav>{navItems.map(item => <button key={item.id} className={`nav-item ${page === item.id || (['instructions','form','review','success','detail','result','tracking'].includes(page) && item.id === 'home') ? 'active' : ''}`} onClick={() => goNav(item.id)}><item.icon size={18}/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-bottom">
        <div className="privacy-card"><ShieldCheck size={19}/><b>Data terlindungi</b><p>Riwayat asesmen ditampilkan berdasarkan NIM Anda.</p></div>
        <button className="nav-item logout" onClick={logout}><LogOut size={18}/>Hapus token / keluar</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)}><Menu/></button>
        <div><span className="eyebrow">LAYANAN KESEHATAN DIGITAL</span><h1>{pageTitle(page)}</h1></div>
        <div className="top-actions"><span className="secure-pill"><span/> Koneksi aman</span><button className="icon-button" onClick={refreshHome} title="Muat ulang"><RefreshCw size={17}/></button><div className="avatar">{identity.nama.split(' ').slice(-1)[0]?.[0] || 'F'}</div></div>
      </header>

      {notice && <div className={`notice ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={18}/> : <Info size={18}/>}</span>{notice.message}<button onClick={() => setNotice(null)}><X size={16}/></button></div>}
      {loading && <div className="loading-line"><span/></div>}

      {page === 'settings' && <SettingsPage config={config} onSave={startSetup} loading={loading}/>}
      {page === 'home' && <HomePage profile={profile} forms={forms} history={history} uts={uts} onOpenForm={openForm} onOpenRecord={openRecord} onNavigate={goNav} loading={loading}/>}
      {page === 'instructions' && <InstructionsPage form={activeForm} consent={consent} setConsent={setConsent} onBack={() => setPage('home')} onStart={createDraft} loading={loading}/>}
      {page === 'form' && <FormPage form={activeForm} sections={visibleSections} current={currentSection} index={sectionIndex} setIndex={setSectionIndex} answers={answers} setAnswer={setAnswer} errors={validation?.errors || {}} onSave={() => saveDraft(false)} onNext={() => saveDraft(true)} onReview={validateForm} onBack={() => setPage('instructions')} loading={loading}/>}
      {page === 'review' && <ReviewPage form={activeForm} answers={answers} validation={validation} onBack={() => setPage('form')} onSubmit={submitAssessment} loading={loading}/>}
      {page === 'success' && <SuccessPage onHome={() => { setPage('home'); refreshHome() }} onHistory={() => setPage('history')}/>}
      {page === 'history' && <HistoryPage history={history} onOpen={openRecord} onResume={resumeDraft} onDelete={deleteDraft} loading={loading}/>}
      {page === 'detail' && <DetailPage detail={detail} result={result} tracking={tracking} onBack={() => setPage('history')} onResult={() => setPage('result')} onTracking={() => setPage('tracking')}/>}
      {page === 'result' && <ResultPage result={result} detail={detail} onBack={() => setPage('detail')}/>}
      {page === 'tracking' && <TrackingPage tracking={tracking} onBack={() => setPage('detail')} onReply={replyClarification} loading={loading}/>}
      {page === 'uts' && <UtsPage data={uts} onRefresh={refreshHome} loading={loading}/>}
    </main>
  </div>
}

function pageTitle(page) {
  return ({home:'Beranda',settings:'Pengaturan akun',instructions:'Petunjuk pengisian',form:'Pengisian asesmen',review:'Periksa jawaban',success:'Pengiriman berhasil',history:'Riwayat asesmen',detail:'Detail asesmen',result:'Hasil asesmen',tracking:'Status & tindak lanjut',uts:'Status tugas UTS'})[page] || 'Beranda'
}
function SettingsPage({ config, onSave, loading }) {
  const [form, setForm] = useState({ ...DEFAULT_IDENTITY, ...config })
  const update = (key, value) => setForm(p => ({ ...p, [key]: value }))
  return <div className="page-wrap narrow">
    <div className="page-intro"><span className="kicker">KONFIGURASI AWAL</span><h2>Hubungkan akun pasien</h2><p>Masukkan identitas mahasiswa dan token pasien yang dibagikan dosen untuk menghubungkan aplikasi ke layanan Telehealth.</p></div>
    <div className="panel setup-panel">
      <div className="panel-heading"><div className="heading-icon"><UserRound/></div><div><h3>Identitas mahasiswa</h3><p>Identitas ini dikirim saat membuat self-assessment.</p></div></div>
      <div className="field-grid">
        <Field label="NIM" value={form.nim} onChange={v => update('nim', v)}/>
        <Field label="Nama lengkap" value={form.nama} onChange={v => update('nama', v)}/>
        <Field label="Kelas" value={form.kelas} onChange={v => update('kelas', v)}/>
      </div>
      <div className="divider"/>
      <div className="panel-heading"><div className="heading-icon mint"><ShieldCheck/></div><div><h3>Token pasien</h3><p>Gunakan token akun P-003 yang diberikan dosen.</p></div></div>
      <Field label="Bearer token" value={form.token || ''} onChange={v => update('token', v)} placeholder="Tempel token pasien dari dosen" type="password"/>
      <div className="security-note"><ShieldCheck size={18}/><span>Token disimpan hanya pada localStorage browser ini. Token tidak dimasukkan ke source code atau repository.</span></div>
      <button className="btn primary full" disabled={loading} onClick={() => onSave(form)}>{loading ? 'Memeriksa koneksi…' : 'Simpan & uji koneksi'} <ArrowRight size={17}/></button>
    </div>
    <div className="small-note"><Info size={16}/> API tujuan: <b>{API_BASE}</b></div>
  </div>
}
function HomePage({ profile, forms, history, uts, onOpenForm, onOpenRecord, onNavigate, loading }) {
  const stats = profile?.statistik || {}
  const patient = profile?.nama || 'Akun pasien belum terhubung'
  return <div className="page-wrap">
    <section className="welcome-banner">
      <div className="welcome-copy"><span className="kicker light">PORTAL PASIEN</span><h2>Halo, {patient.split(' ')[0]}.</h2><p>Kelola informasi kesehatan dan pantau proses self-assessment Anda dalam satu tempat.</p><div className="banner-tags"><span><ShieldCheck size={14}/> Privasi terjaga</span><span><Activity size={14}/> Pemantauan mandiri</span></div></div>
      <div className="banner-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="pulse-card"><HeartPulse size={48}/><span>HEALTH<br/>CHECK-IN</span></div><div className="floating-dot dot-a"/><div className="floating-dot dot-b"/></div>
    </section>
    <div className="section-head"><div><span className="kicker">RINGKASAN</span><h2>Aktivitas asesmen</h2></div><button className="text-link" onClick={() => onNavigate('history')}>Lihat riwayat <ArrowRight size={15}/></button></div>
    <div className="stat-grid">
      <StatCard label="Total asesmen" value={stats.total ?? history.length ?? 0} icon={ClipboardList} tone="lavender"/>
      <StatCard label="Draf tersimpan" value={stats.draf ?? history.filter(x => x.status_pengiriman?.kode === 'draft').length} icon={Save} tone="blue"/>
      <StatCard label="Menunggu tinjauan" value={stats.menunggu ?? 0} icon={Clock3} tone="amber"/>
      <StatCard label="Sudah ditinjau" value={stats.sudah_ditinjau ?? 0} icon={CheckCircle2} tone="green"/>
    </div>
    <div className="content-grid">
      <section className="panel form-panel"><div className="panel-title-row"><div><span className="kicker">MULAI DARI SINI</span><h3>Pilih formulir</h3></div><span className="mini-label">TERSEDIA</span></div>
        <div className="form-options">
          {(forms.length ? forms : [{id:'FRM-KELUHAN',judul:'Formulir Keluhan Pasien Sebelum Konsultasi',estimasi_menit:5,jenis_hasil:'Ringkasan jawaban'},{id:'FRM-GAD7',judul:'Kuesioner Kecemasan (GAD-7)',estimasi_menit:3,jenis_hasil:'Skor instrumen'}]).map((f,i) => <div className="form-option" key={f.id || i}><div className={`form-icon ${i ? 'violet' : ''}`}>{i ? <Activity/> : <Stethoscope/>}</div><div className="form-option-copy"><b>{f.judul || f.title}</b><span>{f.estimasi_menit ? `${f.estimasi_menit} menit` : 'Formulir self-assessment'} · {f.jenis_hasil || 'Penilaian mandiri'}</span></div><button className="round-arrow" onClick={() => onOpenForm(f.id || f.form_id)}><ArrowRight size={17}/></button></div>)}
        </div>
      </section>
      <section className="panel uts-card"><div className="panel-title-row"><div><span className="kicker">PROGRES AKADEMIK</span><h3>Status tugas UTS</h3></div><FileCheck2 className="muted-icon"/></div>
        <div className="uts-progress"><div className="progress-ring"><b>{uts?.bukti_fitur?.tercapai ?? 0}<small>/{uts?.bukti_fitur?.total ?? 10}</small></b></div><div><b>Bukti fitur terdeteksi</b><p>Fitur frontend yang telah tercatat oleh API.</p></div></div>
        <div className="progress-track"><span style={{width:`${Math.min(100, (uts?.bukti_fitur?.tercapai || 0) / (uts?.bukti_fitur?.total || 10) * 100)}%`}}/></div>
        <div className="uts-foot"><span>Status penilaian</span><b>{uts?.penilaian?.status?.label || 'Belum diperiksa'}</b></div><button className="btn secondary full" onClick={() => onNavigate('uts')}>Lihat detail UTS <ArrowRight size={16}/></button>
      </section>
    </div>
    <div className="section-head recent-head"><div><span className="kicker">TERBARU</span><h2>Riwayat terakhir</h2></div><button className="text-link" onClick={() => onNavigate('history')}>Semua riwayat <ArrowRight size={15}/></button></div>
    {history.length ? <div className="panel recent-list">{history.slice(0,3).map(item => <HistoryRow key={item.id} item={item} onOpen={onOpenRecord}/>)}</div> : <EmptyState title="Belum ada asesmen" text="Pilih formulir di atas untuk memulai self-assessment pertama Anda."/>}
  </div>
}
function StatCard({label,value,icon:Icon,tone}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><div><span>{label}</span><b>{value}</b></div></div> }
function InstructionsPage({form,consent,setConsent,onBack,onStart,loading}) {
  const instructions = form?.petunjuk
  return <div className="page-wrap narrow"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Kembali ke beranda</button><div className="page-intro"><span className="kicker">SEBELUM MEMULAI</span><h2>{form?.judul || form?.title || 'Petunjuk pengisian'}</h2><p>Baca informasi berikut sebelum melanjutkan ke pertanyaan.</p></div>
    <div className="panel instructions-panel"><div className="instruction-highlight"><Info size={20}/><div><b>Tujuan pengisian</b><p>{typeof instructions === 'string' ? instructions : instructions?.tujuan || 'Formulir ini digunakan untuk mencatat informasi kesehatan awal sebelum konsultasi dengan tenaga kesehatan.'}</p></div></div>
      {form?.persetujuan && <div className="consent-copy"><h3>Persetujuan</h3><p>{typeof form.persetujuan === 'string' ? form.persetujuan : form.persetujuan?.teks || form.persetujuan?.deskripsi || 'Saya memahami bahwa informasi yang saya berikan digunakan untuk keperluan self-assessment dan peninjauan oleh tenaga kesehatan.'}</p></div>}
      <div className="consent-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>Saya telah membaca petunjuk dan menyetujui pengisian formulir ini.</span></div>
      <button className="btn primary full" disabled={!consent || loading} onClick={onStart}>Mulai pengisian <ArrowRight size={17}/></button>
    </div>
    <p className="disclaimer"><ShieldCheck size={16}/> Informasi yang Anda masukkan akan dikirim melalui layanan Telehealth untuk ditinjau.</p>
  </div>
}
function FormPage({form,sections,current,index,setIndex,answers,setAnswer,errors,onSave,onNext,onReview,onBack,loading}) {
  if (!current) return <div className="page-wrap"><EmptyState title="Bagian formulir belum tersedia" text="Definisi bagian belum dikirim oleh API."/><button className="btn secondary" onClick={onBack}>Kembali</button></div>
  const questionList = asArray(current.questions).filter(q => isVisible(q.show_if, answers))
  const progress = Math.round(((index + 1) / Math.max(sections.length,1)) * 100)
  return <div className="page-wrap narrow"><div className="form-topline"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Keluar ke petunjuk</button><span className="draft-badge"><span/> Draf tersimpan setelah klik simpan</span></div>
    <div className="form-progress"><div><span>Bagian {index + 1} dari {sections.length}</span><b>{progress}%</b></div><div className="progress-track"><span style={{width:`${progress}%`}}/></div></div>
    <div className="page-intro form-intro"><span className="kicker">FORMULIR SELF-ASSESSMENT</span><h2>{current.judul || current.title || current.label || current.id}</h2><p>{current.deskripsi || 'Jawab setiap pertanyaan sesuai kondisi Anda. Kolom bertanda * wajib diisi.'}</p></div>
    <div className="panel question-panel">{questionList.map(q => <Question key={q.id} q={q} value={answers[q.id]} onChange={v => setAnswer(q.id,v)} error={errors?.[q.id]}/>)}
      <div className="form-actions"><button className="btn ghost" onClick={onSave} disabled={loading}><Save size={16}/> Simpan draf</button><div className="action-right">{index > 0 && <button className="btn secondary" onClick={() => setIndex(i => Math.max(0,i-1))}>Sebelumnya</button>}{index < sections.length - 1 ? <button className="btn primary" onClick={onNext} disabled={loading}>Lanjut <ArrowRight size={16}/></button> : <button className="btn primary" onClick={onReview} disabled={loading}>Periksa jawaban <ArrowRight size={16}/></button>}</div></div>
    </div>
    <div className="form-footer-note"><Info size={15}/> Jawaban yang belum diisi tidak dianggap sebagai jawaban “Tidak”.</div>
  </div>
}
function Question({q,value,onChange,error}) {
  const options = asArray(q.options)
  const label = q.label || q.pertanyaan || q.question || q.title || q.id
  const required = q.required ?? q.wajib
  const type = q.type || q.tipe || 'text'
  const optionValue = o => typeof o === 'object' ? (o.value ?? o.nilai ?? o.id) : o
  const optionLabel = o => typeof o === 'object' ? (o.label ?? o.teks ?? o.nama ?? o.value) : o
  return <div className={`question ${error ? 'has-error' : ''}`}><label className="question-label">{label}{required && <em>*</em>}</label>{q.help_text && <small className="field-hint">{q.help_text}</small>}
    {type === 'text' && <input className="control" value={value ?? ''} maxLength={q.max_length || undefined} placeholder={q.placeholder || 'Tulis jawaban Anda'} onChange={e => onChange(e.target.value)}/>}
    {type === 'textarea' && <textarea className="control textarea" value={value ?? ''} maxLength={q.max_length || undefined} placeholder={q.placeholder || 'Tulis jawaban Anda'} onChange={e => onChange(e.target.value)}/>}
    {type === 'number' && <div className="number-wrap"><input className="control" type="number" value={value ?? ''} min={q.min ?? undefined} max={q.max ?? undefined} step="any" onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}/>{q.unit && <span>{q.unit}</span>}</div>}
    {type === 'date' && <input className="control" type="date" value={value ?? ''} max={new Date().toISOString().slice(0,10)} onChange={e => onChange(e.target.value)}/>}
    {type === 'single_choice' && <div className="choice-grid">{options.map((o,i) => <label className={`choice-card ${value === optionValue(o) ? 'selected' : ''}`} key={i}><input type="radio" name={q.id} checked={value === optionValue(o)} onChange={() => onChange(optionValue(o))}/><span className="choice-dot"/><span>{optionLabel(o)}</span></label>)}</div>}
    {type === 'scale' && <div className="scale-grid">{options.map((o,i) => <button type="button" className={`scale-option ${String(value) === String(optionValue(o)) ? 'selected' : ''}`} key={i} onClick={() => onChange(optionValue(o))}><b>{optionValue(o)}</b><span>{optionLabel(o)}</span></button>)}</div>}
    {type === 'multi_choice' && <div className="choice-grid">{options.map((o,i) => {const v=optionValue(o);const arr=Array.isArray(value)?value:[];const checked=arr.includes(v);return <label className={`choice-card ${checked?'selected':''}`} key={i}><input type="checkbox" checked={checked} onChange={e => {let next=e.target.checked?[...arr,v]:arr.filter(x=>x!==v);if(o.exclusive && e.target.checked)next=[v];else if(next.some(x=>options.some(z=>optionValue(z)===x&&z.exclusive)))next=[v];onChange(next)}}/><span className="choice-check">{checked&&<Check size={13}/>}</span><span>{optionLabel(o)}</span></label>})}</div>}
    {error && <div className="error-text">{error}</div>}
    {q.data_type === 'pengukuran' && <small className="measurement-hint">Data pengukuran · Masukkan nilai sesuai hasil pengukuran terakhir.</small>}
  </div>
}
function ReviewPage({form,answers,validation,onBack,onSubmit,loading}) {
  const errors = validation?.errors || {}
  const complete = validation?.kelengkapan
  const sections = asArray(form?.sections)
  const questions = sections.flatMap(s => asArray(s.questions)).filter(q => isVisible(q.show_if,answers))
  const labelOf = q => q.label || q.pertanyaan || q.question || q.id
  return <div className="page-wrap narrow"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Kembali ke formulir</button><div className="page-intro"><span className="kicker">LANGKAH TERAKHIR</span><h2>Periksa kembali jawaban</h2><p>Pastikan informasi sudah benar sebelum dikirim kepada petugas.</p></div>
    <div className="review-summary"><div className="review-score"><div><b>{complete?.persen ?? (Object.keys(answers).length ? '—' : 0)}{complete?.persen != null ? '%' : ''}</b><span>Kelengkapan</span></div><div className="review-track"><span style={{width:`${complete?.persen ?? 0}%`}}/></div></div><div className="review-count"><b>{complete?.wajib_terisi ?? '—'}<small>/{complete?.wajib_total ?? '—'}</small></b><span>Kolom wajib terisi</span></div></div>
    {Object.keys(errors).length > 0 && <div className="alert-error"><Info size={18}/><div><b>Masih ada jawaban yang perlu diperbaiki</b><p>Periksa kolom yang ditandai sebelum mengirim.</p></div></div>}
    <div className="panel review-panel">{sections.filter(s=>isVisible(s.show_if,answers)).map((s,i)=><div className="review-section" key={s.id||i}><h3>{s.judul||s.title||s.label||s.id}</h3>{asArray(s.questions).filter(q=>isVisible(q.show_if,answers)).map(q=><div className="review-row" key={q.id}><span>{labelOf(q)}</span><b className={answers[q.id]===undefined||answers[q.id]===''?'empty':''}>{formatAnswer(answers[q.id],q.options)}</b>{errors[q.id]&&<small className="error-text">{errors[q.id]}</small>}</div>)}</div>)}</div>
    <div className="disclaimer-box"><ShieldCheck size={18}/><span>Hasil self-assessment bukan diagnosis. Informasi ini menjadi bahan awal untuk ditinjau oleh tenaga kesehatan.</span></div>
    <div className="form-actions"><button className="btn secondary" onClick={onBack}>Perbaiki jawaban</button><button className="btn primary" disabled={loading || (validation && validation.valid === false)} onClick={onSubmit}>{loading?'Mengirim…':'Kirim jawaban'} <ArrowRight size={16}/></button></div>
  </div>
}
function formatAnswer(value,options=[]) {
  if (value === undefined || value === null || value === '') return 'Belum diisi'
  const opts=asArray(options)
  const find=v=>{const o=opts.find(x=>(typeof x==='object'?(x.value??x.nilai??x.id):x)===v);return o?(typeof o==='object'?(o.label??o.teks??o.nama??v):o):v}
  return Array.isArray(value)?value.map(find).join(', '):find(value)
}
function SuccessPage({onHome,onHistory}) { return <div className="page-wrap narrow success-wrap"><div className="success-icon"><Check size={42}/></div><span className="kicker">FORMULIR DITERIMA</span><h2>Terima kasih telah mengisi.</h2><p>Jawaban Anda sudah dikirim ke layanan Telehealth. Anda dapat melihat riwayat dan memantau status peninjauan kapan saja.</p><div className="success-status"><span/><div><b>Menunggu peninjauan</b><small>Petugas akan meninjau laporan Anda.</small></div></div><div className="button-row"><button className="btn secondary" onClick={onHistory}>Lihat riwayat</button><button className="btn primary" onClick={onHome}>Kembali ke beranda <ArrowRight size={16}/></button></div></div> }
function HistoryPage({history,onOpen,onResume,onDelete,loading}) { const [filter,setFilter]=useState('semua'); const list=history.filter(x=>filter==='semua'||(filter==='draft'?x.status_pengiriman?.kode==='draft':filter==='clarify'?x.status_peninjauan?.kode==='perlu_klarifikasi':x.status_pengiriman?.kode!=='draft')); return <div className="page-wrap"><div className="page-intro"><span className="kicker">ARSIP PRIBADI</span><h2>Riwayat self-assessment</h2><p>Daftar pengisian yang tercatat menggunakan NIM Anda.</p></div><div className="filter-tabs">{[['semua','Semua'],['draft','Draf'],['terkirim','Terkirim'],['clarify','Perlu klarifikasi']].map(([v,l])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className="panel recent-list">{list.length?list.map(item=><HistoryRow key={item.id} item={item} onOpen={onOpen} onResume={onResume} onDelete={onDelete}/>):<EmptyState title="Tidak ada data" text="Belum ada riwayat pada kategori ini."/>}</div></div> }
function HistoryRow({item,onOpen,onResume,onDelete}) { const draft=item.status_pengiriman?.kode==='draft'; const clarify=item.status_peninjauan?.kode==='perlu_klarifikasi'; return <div className="history-row"><div className="history-file"><FileCheck2 size={20}/></div><div className="history-info"><b>{item.judul || item.form?.judul || item.form?.id || 'Self-assessment'}</b><span>{item.id} · {formatDate(item.dibuat_pada)}</span><div className="status-pills"><StatusPill value={item.status_pengiriman?.label || item.status_pengiriman?.kode}/><StatusPill value={item.status_peninjauan?.label || item.status_peninjauan?.kode}/></div></div><div className="history-actions">{draft?<><button className="btn small secondary" onClick={()=>onResume?.(item)}>Lanjutkan</button><button className="icon-button danger" title="Hapus draf" onClick={()=>onDelete?.(item.id)}><Trash2 size={16}/></button></>:<button className="btn small secondary" onClick={()=>onOpen(item)}>Lihat detail <ArrowRight size={15}/></button>}</div>{clarify&&<span className="clarify-flag"><Bell size={13}/> Perlu respons</span>}</div> }
function StatusPill({value}) { const s=String(value||'').toLowerCase(); const tone=s.includes('klarifikasi')?'amber':s.includes('draf')||s.includes('draft')?'muted':s.includes('ditinjau')||s.includes('terkirim')?'green':'blue'; return <span className={`status-pill ${tone}`}>{value||'Belum tersedia'}</span> }
function DetailPage({detail,result,tracking,onBack,onResult,onTracking}) { const data=detail?.data||detail; const assessment=data?.hasil||result; return <div className="page-wrap"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Kembali ke riwayat</button><div className="page-intro"><span className="kicker">RINGKASAN LAPORAN</span><h2>{data?.judul || assessment?.judul || 'Detail asesmen'}</h2><p>ID laporan: {data?.id || '—'} · Dibuat {formatDate(data?.dibuat_pada)}</p></div><div className="detail-grid"><div className="panel detail-card"><span className="kicker">STATUS PENGIRIMAN</span><h3>{data?.status_pengiriman?.label || '—'}</h3><p>{data?.pesan_status || 'Laporan tersimpan pada layanan Telehealth.'}</p></div><div className="panel detail-card"><span className="kicker">STATUS PENINJAUAN</span><h3>{data?.status_peninjauan?.label || '—'}</h3><p>Status peninjauan diperbarui oleh petugas.</p></div></div><div className="panel review-panel"><h3>Ringkasan jawaban</h3>{asArray(assessment?.ringkasan).map((r,i)=><div className="review-row" key={i}><span>{r.label || r.pertanyaan || r.question_id}</span><b>{r.jawaban_teks || 'Belum diisi'}</b></div>)}{!asArray(assessment?.ringkasan).length&&<p className="muted-text">Ringkasan jawaban belum tersedia dari API.</p>}</div><div className="button-row"><button className="btn secondary" onClick={onResult}>Lihat hasil asesmen</button><button className="btn primary" onClick={onTracking}>Pantau status <ArrowRight size={16}/></button></div></div> }
function ResultPage({result,detail,onBack}) { const r=result?.hasil||result||detail?.hasil; const score=r?.skor; return <div className="page-wrap narrow"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Kembali ke detail</button><div className="page-intro"><span className="kicker">HASIL SELF-ASSESSMENT</span><h2>{r?.judul || 'Ringkasan hasil'}</h2><p>Hasil ditampilkan sesuai data yang dikirim oleh layanan Telehealth.</p></div>{score&&<div className="score-card"><span>SKOR TOTAL</span><b>{score.total}<small>/{score.maks}</small></b><strong>{score.kategori?.label || score.kategori?.kode}</strong><p>{score.keterangan}</p></div>}<div className="panel review-panel"><h3>Kelengkapan jawaban</h3><div className="completion-line"><b>{r?.kelengkapan?.persen ?? 0}%</b><span>{r?.kelengkapan?.label || r?.kelengkapan?.status || 'Data kelengkapan'}</span></div><div className="progress-track"><span style={{width:`${r?.kelengkapan?.persen||0}%`}}/></div><p className="muted-text">{r?.langkah_berikutnya || 'Silakan pantau status peninjauan secara berkala.'}</p></div><div className="disclaimer-box"><ShieldCheck size={19}/><span>{r?.keterbatasan || 'Hasil self-assessment bukan diagnosis dan tidak menggantikan pemeriksaan tenaga kesehatan.'}</span></div></div> }
function TrackingPage({tracking,onBack,onReply,loading}) { const t=tracking?.data||tracking; const [reply,setReply]=useState({}); const clarifications=asArray(t?.klarifikasi_menunggu); const follow=t?.tindak_lanjut; return <div className="page-wrap"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Kembali ke detail</button><div className="page-intro"><span className="kicker">PEMANTAUAN</span><h2>Status & tindak lanjut</h2><p>Pantau pengiriman, proses peninjauan, dan arahan dari petugas.</p></div><div className="detail-grid"><div className="panel detail-card"><span className="kicker">PENGIRIMAN</span><h3>{t?.status_pengiriman?.label || '—'}</h3></div><div className="panel detail-card"><span className="kicker">PENINJAUAN</span><h3>{t?.status_peninjauan?.label || '—'}</h3></div></div><div className="panel timeline-panel"><h3>Perjalanan laporan</h3>{asArray(t?.timeline).length?asArray(t.timeline).map((ev,i)=><div className="timeline-item" key={i}><span className="timeline-dot"/><div><b>{ev.event || ev.judul || 'Pembaruan status'}</b><p>{ev.keterangan || ev.pesan || ''}</p><small>{formatDate(ev.waktu)}</small></div></div>):<p className="muted-text">{t?.pesan || 'Belum ada pembaruan timeline.'}</p>}</div>{clarifications.length>0&&<div className="panel clarification-panel"><div className="panel-title-row"><h3><MessageCircle size={18}/> Klarifikasi dari petugas</h3><StatusPill value="Menunggu jawaban"/></div>{clarifications.map(c=><div className="clarification-item" key={c.id}><b>{c.pertanyaan}</b><textarea className="control textarea" placeholder="Tulis jawaban klarifikasi…" value={reply[c.id]||''} onChange={e=>setReply(p=>({...p,[c.id]:e.target.value}))}/><button className="btn primary" disabled={loading||!reply[c.id]?.trim()} onClick={()=>onReply(c.id,reply[c.id])}>Kirim jawaban <ArrowRight size={15}/></button></div>)}</div>}{follow&&<div className="panel follow-card"><span className="kicker">TINDAK LANJUT</span><h3>{follow.jenis?.label || follow.jenis?.kode || 'Arahan petugas'}</h3><p>{follow.arahan || 'Tidak ada arahan tambahan.'}</p>{follow.jadwal_konsultasi&&<div className="schedule"><Clock3 size={18}/><div><small>Jadwal konsultasi</small><b>{formatDate(follow.jadwal_konsultasi)}</b></div></div>}</div>}</div> }
function UtsPage({data,onRefresh,loading}) { const b=data?.bukti_fitur; const list=asArray(b?.daftar); return <div className="page-wrap narrow"><div className="page-intro"><span className="kicker">MONITORING TUGAS</span><h2>Status tugas UTS</h2><p>Informasi bukti fitur dan status penilaian yang tercatat pada API.</p></div><div className="panel uts-detail"><div className="uts-score"><div className="progress-ring large"><b>{b?.tercapai ?? 0}<small>/{b?.total ?? 10}</small></b></div><div><h3>{data?.penilaian?.status?.label || 'Belum diperiksa'}</h3><p>{data?.penilaian?.catatan || 'Status penilaian akan diperbarui oleh dosen.'}</p></div></div><div className="progress-track"><span style={{width:`${Math.min(100,(b?.tercapai||0)/(b?.total||10)*100)}%`}}/></div><h3 className="checklist-title">Bukti fitur</h3>{list.length?list.map((x,i)=><div className="check-row" key={x.kode||i}><span className={x.tercapai?'check-ok':'check-pending'}>{x.tercapai?<Check size={14}/>:<Clock3 size={14}/>}</span><span>{x.label || x.kode}</span><b>{x.tercapai?'Tercapai':'Belum'}</b></div>):<p className="muted-text">Belum ada daftar bukti fitur yang dikirim API.</p>}<button className="btn secondary full" onClick={onRefresh} disabled={loading}><RefreshCw size={16}/> Perbarui status</button></div></div> }
function Field({label,value,onChange,placeholder,type='text'}) { return <label className="field"><span>{label}</span><input className="control" type={type} value={value??''} placeholder={placeholder||''} onChange={e=>onChange(e.target.value)}/></label> }
function EmptyState({title,text}) { return <div className="empty-state"><div><ClipboardList size={24}/></div><b>{title}</b><p>{text}</p></div> }
function isVisible(cond, answers) {
  if (!cond) return true
  if (cond.any) return cond.any.some(c => isVisible(c, answers))
  if (cond.all) return cond.all.every(c => isVisible(c, answers))
  const v = answers?.[cond.question]
  const filled = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)
  if ('equals' in cond) return v === cond.equals
  if ('in' in cond) return cond.in.includes(v)
  if ('includes' in cond) return Array.isArray(v) && v.includes(cond.includes)
  if ('filled' in cond) return filled === cond.filled
  return true
}

export default App
