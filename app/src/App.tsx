import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Split, Wallet, Loader2, Plus, UserPlus, Coins, PieChart } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const toGen = (w: string | number) => Number(BigInt(w || '0')) / 1e18
type Contrib = { contributor: string; evidence: string; score: number; paid_wei: string }
type Work = { id: string; title: string; contributions: Contrib[]; state: string; note: string }
const HUES = ['#facc15', '#ec4899', '#34d399', '#38bdf8', '#a78bfa', '#fb923c', '#f43f5e', '#2dd4bf', '#c084fc', '#84cc16', '#fbbf24', '#60a5fa']

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_works: 0, settled: 0, distributed_wei: '0' })
  const [works, setWorks] = useState<Work[]>([]); const [sel, setSel] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(''); const [ct, setCt] = useState({ c: '', e: '' }); const [rev, setRev] = useState('')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_works: Number(s?.total_works ?? 0), settled: Number(s?.settled ?? 0), distributed_wei: String(s?.distributed_wei ?? '0') })
      const total = Number(s?.total_works ?? 0); const out: Work[] = []
      for (let i = total - 1; i >= 0 && i >= total - 14; i--) { try { const w = (await read('get_work', [String(i)])) as any; if (w?.exists) out.push({ ...w, id: String(i), contributions: w.contributions ?? [] }) } catch {} }
      setWorks(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  function wei(g: string) { return BigInt(Math.round((Number(g) || 0) * 1e18)) }
  async function create() { if (!title.trim()) return toast.error('Title.'); setCreating(true); const t = toast.loading('Creating…'); try { const id = (await write('create_work', [title.trim()])) as any; toast.success('Created.', { id: t }); setTitle(''); setOpen(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function addC(w: Work) { if (!ct.c.trim() || !ct.e.trim()) return toast.error('Contributor + evidence.'); setBusy('add'); const t = toast.loading('Adding…'); try { await write('add_contribution', [w.id, ct.c.trim(), ct.e.trim()]); setCt({ c: '', e: '' }); toast.success('Added.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function settle(w: Work) { if (!(Number(rev) > 0)) return toast.error('Revenue > 0'); setBusy(w.id); const t = toast.loading('Scoring + splitting… (30–60s)'); try { await write('settle', [w.id], wei(rev)); setRev(''); toast.success('Split & paid.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const w = works.find((x) => x.id === sel) || null
  const total = w ? w.contributions.reduce((s, c) => s + (c.score || 0), 0) : 0
  const settled = w?.state === 'settled'
  // donut segments
  const C = 2 * Math.PI * 52; let acc = 0
  const segs = (w && settled && total > 0) ? w.contributions.map((c, i) => { const frac = c.score / total; const seg = { color: HUES[i % HUES.length], len: frac * C, off: -acc * C, pct: frac * 100 }; acc += frac; return seg }) : []

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#facc1518,transparent_60%)]" />

      {/* floating pill nav — a centered rounded island, detached from the edges */}
      <nav className="sticky top-4 z-30 mx-auto mt-4 flex w-[calc(100%-1.75rem)] max-w-3xl items-center gap-2.5 rounded-full border border-border bg-card/80 py-2 pl-5 pr-2 shadow-2xl shadow-black/50 ring-1 ring-white/[0.04] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15"><Split className="h-4 w-4 text-primary" /></span>
          <span className="text-[15px] font-extrabold tracking-tight">RoyaltySplit</span>
        </div>
        <div className="ml-2.5 hidden items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1 font-mono text-[11px] text-muted sm:flex">
          <b className="text-accent"><NumberTicker value={Number(toGen(stats.distributed_wei).toFixed(2))} decimalPlaces={2} /></b> GEN
          <span className="opacity-40">·</span>
          <b className="text-foreground"><NumberTicker value={stats.settled} /></b> settled
        </div>
        <Button size="sm" variant="outline" className="ml-auto rounded-full" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> Work</Button>
        <Button size="sm" variant={wallet ? 'outline' : 'primary'} className="rounded-full" onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
      </nav>

      <div className="mx-auto max-w-5xl px-5 pt-9">
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mb-4 flex gap-2 rounded-2xl border border-border bg-card/60 p-3"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Work title (song, paper, repo…)" className="flex-1 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" onClick={create} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Split className="h-4 w-4" />} Create</Button></div>
          </motion.div>
        )}
        <div className="flex flex-wrap gap-2">{works.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`max-w-[200px] truncate rounded-full border px-3.5 py-1.5 text-xs transition-colors ${sel === x.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground'}`}>{x.title}</button>)}</div>
      </div>

      {!w ? <div className="mx-auto max-w-5xl px-5 py-24 text-center text-sm text-muted">No works yet — spin one up from the nav.</div> : (
        <main className="mx-auto grid max-w-5xl gap-7 px-5 py-8 md:grid-cols-[290px_1fr]">
          {/* split donut */}
          <div className="flex flex-col items-center rounded-3xl border border-border bg-card/50 p-6">
            <div className="relative h-44 w-44">
              <svg viewBox="0 0 128 128" className="-rotate-90">
                <circle cx="64" cy="64" r="52" fill="none" stroke="#ffffff0d" strokeWidth="18" />
                {settled && total > 0 ? segs.map((s, i) => <circle key={i} cx="64" cy="64" r="52" fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${s.len} ${C - s.len}`} strokeDashoffset={s.off} />)
                  : <circle cx="64" cy="64" r="52" fill="none" stroke="#2a2a3a" strokeWidth="18" strokeDasharray="4 6" />}
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center"><div><PieChart className="mx-auto h-5 w-5 text-muted" /><div className="mt-1 text-xs text-muted">{settled ? 'split' : 'unsettled'}</div></div></div>
            </div>
            <div className="mt-4 text-center text-lg font-bold">{w.title}</div>
            <div className="mt-1 text-xs text-muted">{w.contributions.length} contributor{w.contributions.length === 1 ? '' : 's'}</div>
            {settled && total > 0 && (
              <div className="mt-4 w-full space-y-1.5">
                {w.contributions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HUES[i % HUES.length] }} />
                    <span className="truncate font-mono text-muted">{short(c.contributor)}</span>
                    <span className="ml-auto font-mono tabular-nums text-foreground">{((c.score / total) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* cap table */}
          <div>
            <div className="overflow-hidden rounded-3xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-card/80 text-[11px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2.5 font-medium">Contributor</th><th className="px-4 py-2.5 font-medium">Contribution</th><th className="px-4 py-2.5 text-right font-medium">Share</th><th className="px-4 py-2.5 text-right font-medium">Payout</th></tr></thead>
                <tbody className="divide-y divide-border/60">
                  {w.contributions.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">No contributions yet.</td></tr>}
                  {w.contributions.map((c, i) => (
                    <tr key={i} className="bg-background/30">
                      <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: settled ? HUES[i % HUES.length] : '#444' }} /><span className="font-mono text-xs">{short(c.contributor)}</span></div></td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-muted">{c.evidence}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{settled && total > 0 ? `${((c.score / total) * 100).toFixed(0)}%` : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent">{Number(c.paid_wei) > 0 ? toGen(c.paid_wei) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {settled && w.note && <p className="mt-3 text-xs italic text-muted">{w.note}</p>}
            {!settled && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2"><input value={ct.c} onChange={(e) => setCt({ ...ct, c: e.target.value })} placeholder="Contributor 0x…" className="w-40 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><input value={ct.e} onChange={(e) => setCt({ ...ct, e: e.target.value })} placeholder="What they contributed" className="min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" variant="outline" disabled={busy === 'add'} onClick={() => addC(w)}><UserPlus className="h-4 w-4" /></Button></div>
                {w.contributions.length >= 1 && <div className="flex gap-2"><div className="relative flex-1"><input value={rev} onChange={(e) => setRev(e.target.value)} placeholder="Revenue to split" className="w-full rounded-xl border border-border bg-background/70 px-3 py-2 pr-12 text-sm outline-none focus:border-primary/50" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent">GEN</span></div><Button size="sm" disabled={busy === w.id} onClick={() => settle(w)}>{busy === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Settle &amp; split</Button></div>}
              </div>
            )}
          </div>
        </main>
      )}

      <footer className="mx-auto flex max-w-5xl items-center justify-between px-5 py-8 text-xs text-muted"><span>RoyaltySplit · consensus-weighted royalty splits</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></footer>
    </div>
  )
}
