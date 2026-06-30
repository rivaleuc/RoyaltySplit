import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Split, Wallet, Loader2, Plus, UserPlus, Coins, ChevronDown,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const toGen = (wei: string | number) => Number(BigInt(wei || '0')) / 1e18

type Contrib = { contributor: string; evidence: string; score: number; paid_wei: string }
type Work = { id: string; creator: string; title: string; contributions: Contrib[]; state: string; note: string }
const HUES = ['#facc15', '#ec4899', '#34d399', '#38bdf8', '#a78bfa', '#fb923c', '#f43f5e', '#2dd4bf', '#c084fc', '#84cc16', '#fbbf24', '#60a5fa']

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_works: 0, settled: 0, distributed_wei: '0' })
  const [works, setWorks] = useState<Work[]>([])
  const [open, setOpen] = useState(false); const [exp, setExp] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [ct, setCt] = useState<Record<string, { c: string; e: string }>>({}); const [rev, setRev] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_works: Number(s?.total_works ?? 0), settled: Number(s?.settled ?? 0), distributed_wei: String(s?.distributed_wei ?? '0') })
      const total = Number(s?.total_works ?? 0); const out: Work[] = []
      for (let i = total - 1; i >= 0 && i >= total - 10; i--) { try { const w = (await read('get_work', [String(i)])) as any; if (w?.exists) out.push({ ...w, id: String(i), contributions: w.contributions ?? [] }) } catch {} }
      setWorks(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  function wei(g: string) { return BigInt(Math.round((Number(g) || 0) * 1e18)) }
  async function create() { if (!title.trim()) return toast.error('Title required.'); setCreating(true); const t = toast.loading('Creating work…'); try { await write('create_work', [title.trim()]); toast.success('Work created.', { id: t }); setTitle(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function addC(w: Work) { const x = ct[w.id] ?? { c: '', e: '' }; if (!x.c.trim() || !x.e.trim()) return toast.error('Contributor + evidence.'); setBusy(w.id); const t = toast.loading('Adding contribution…'); try { await write('add_contribution', [w.id, x.c.trim(), x.e.trim()]); setCt({ ...ct, [w.id]: { c: '', e: '' } }); toast.success('Added.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function settle(w: Work) { const g = rev[w.id]; if (!(Number(g) > 0)) return toast.error('Revenue amount > 0.'); setBusy(w.id); const t = toast.loading('Validators scoring contributions… (30–60s)'); try { await write('settle', [w.id], wei(g)); toast.success('Split & paid out.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#facc1518,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-5">
          <Split className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">RoyaltySplit</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_works} /></b> works · <b className="text-accent"><NumberTicker value={Number(toGen(stats.distributed_wei).toFixed(3))} decimalPlaces={3} /></b> GEN split</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Fair splits, decided by consensus</h1>
        <p className="mt-1 text-sm text-muted">Co-creators log contributions; when revenue arrives, validators score each one and the payout splits proportionally — no haggling.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Create a work'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 flex gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Work title (song, paper, repo…)" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <Button size="sm" onClick={create} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Split className="h-4 w-4" />} Create</Button>
            </div>
          </motion.div>
        )}

        <div className="mt-6 space-y-2">
          {works.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No works yet.</div>}
          {works.map((w) => {
            const x = ct[w.id] ?? { c: '', e: '' }; const settled = w.state === 'settled'
            const totalScore = w.contributions.reduce((s, c) => s + (c.score || 0), 0) || 1
            return (
              <div key={w.id} className="rounded-xl border border-border bg-card/50">
                <button onClick={() => setExp(exp === w.id ? null : w.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Split className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{w.title}</div><div className="text-[11px] text-muted">{w.contributions.length} contributors · {w.state}</div></div>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${exp === w.id ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {exp === w.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-border/60">
                      <div className="space-y-3 p-4">
                        {/* split bar */}
                        {settled && (
                          <div className="flex h-3 w-full overflow-hidden rounded-full">
                            {w.contributions.map((c, i) => <div key={i} title={`${c.contributor}: ${c.score}`} style={{ width: `${(c.score / totalScore) * 100}%`, background: HUES[i % HUES.length] }} />)}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {w.contributions.length === 0 && <p className="text-xs text-muted">No contributions yet.</p>}
                          {w.contributions.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2.5">
                              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: settled ? HUES[i % HUES.length] : '#555' }} />
                              <div className="min-w-0 flex-1"><div className="truncate font-mono text-xs">{c.contributor}</div><div className="truncate text-[11px] text-muted">{c.evidence}</div></div>
                              {settled && <div className="text-right"><div className="font-mono text-sm tabular-nums text-accent">{toGen(c.paid_wei)} GEN</div><div className="text-[10px] text-muted">score {c.score}</div></div>}
                            </div>
                          ))}
                        </div>
                        {settled && w.note && <p className="text-[11px] italic text-muted">{w.note}</p>}
                        {!settled && (
                          <div className="space-y-2">
                            <div className="flex gap-2"><input value={x.c} onChange={(e) => setCt({ ...ct, [w.id]: { ...x, c: e.target.value } })} placeholder="Contributor 0x…" className="w-40 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><input value={x.e} onChange={(e) => setCt({ ...ct, [w.id]: { ...x, e: e.target.value } })} placeholder="What they contributed (evidence)" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" variant="outline" disabled={busy === w.id} onClick={() => addC(w)}><UserPlus className="h-4 w-4" /></Button></div>
                            {w.contributions.length >= 1 && (
                              <div className="flex gap-2"><div className="relative flex-1"><input value={rev[w.id] ?? ''} onChange={(e) => setRev({ ...rev, [w.id]: e.target.value })} placeholder="Revenue to split" className="w-full rounded-md border border-border bg-background/70 px-3 py-2 pr-12 text-sm outline-none focus:border-primary/50" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent">GEN</span></div><Button size="sm" disabled={busy === w.id} onClick={() => settle(w)}>{busy === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Settle &amp; split</Button></div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 text-xs text-muted"><span>RoyaltySplit · consensus-weighted royalty splits on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
