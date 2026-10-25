'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '../components/ui'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
type LoginResponse = { data?: { token: string; user: { role: string } }; error?: string }

export default function LoginPage() {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const router = useRouter()
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); setPending(true); try { const payload = Object.fromEntries(new FormData(event.currentTarget).entries()); const response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const json = await response.json() as LoginResponse; if (!response.ok || !json.data) throw new Error(json.error || 'Unable to log in'); if (!['manager', 'admin'].includes(json.data.user.role)) throw new Error('Manager or admin access is required.'); localStorage.setItem('superleo_manager_token', json.data.token); router.push('/dashboard') } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to log in') } finally { setPending(false) } }
  return <main className="grid min-h-screen place-items-center bg-[#edf4ed] p-6"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-[#dce6dd] bg-white p-8 shadow-xl shadow-[#17372d]/10"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#5a9960]">SuperLeo operations</p><h1 className="mt-4 text-4xl font-bold">Manager sign in</h1><p className="mt-3 leading-7 text-[#71847a]">Access the dairy collection centre workspace.</p><div className="mt-8 flex flex-col gap-4"><label className="text-sm font-bold">Email<Input name="email" type="email" placeholder="manager@superleo.local" required /></label><label className="text-sm font-bold">Password<Input name="password" type="password" placeholder="Your password" required /></label>{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<Button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in to dashboard'}</Button></div></form></main>
}
