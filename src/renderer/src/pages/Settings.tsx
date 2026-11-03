import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Download, Upload } from 'lucide-react'
import type { ShopSettings } from '@shared/types'
import { isDialogOnlyPrinter } from '@shared/constants'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Dropdown } from '@/components/ui/Dropdown'
import { Switch } from '@/components/ui/Switch'
import { Spinner } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export function Settings() {
  const toast = useToast()
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [printers, setPrinters] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [shopNameUrdu, setShopNameUrdu] = useState('')
  const [shopAddressUrdu, setShopAddressUrdu] = useState('')
  const [printerName, setPrinterName] = useState('')
  const [printDialog, setPrintDialog] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState(false)

  useEffect(() => {
    api.settings.get().then((s) => {
      setSettings(s)
      setShopName(s.shopName)
      setShopAddress(s.shopAddress)
      setShopPhone(s.shopPhone)
      setShopNameUrdu(s.shopNameUrdu)
      setShopAddressUrdu(s.shopAddressUrdu)
      setPrinterName(s.printerName ?? '')
      setPrintDialog(s.printDialog ?? false)
    })
    api.print.listPrinters().then(setPrinters).catch(() => setPrinters([]))
  }, [])

  const saveShop = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.settings.update({
        shopName,
        shopAddress,
        shopPhone,
        shopNameUrdu,
        shopAddressUrdu,
        printerName,
        printDialog
      })
      toast('Settings saved')
      setSettings({
        ...settings!,
        shopName,
        shopAddress,
        shopPhone,
        shopNameUrdu,
        shopAddressUrdu,
        printerName: printerName || null,
        printDialog
      })
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error')
      return
    }
    setPwBusy(true)
    try {
      const result = await api.auth.changePassword(oldPassword, newPassword)
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast('Password changed')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setSettings({ ...settings!, passwordChanged: true })
      }
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setPwBusy(false)
    }
  }

  const doBackup = async () => {
    setBackupBusy(true)
    try {
      const result = await api.backup.export()
      if (result.ok && result.path) toast(`Backup saved to ${result.path}`)
      else if (!result.cancelled) toast(result.error || 'Backup failed', 'error')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBackupBusy(false)
    }
  }

  const doRestore = async () => {
    setRestoreConfirm(false)
    setBackupBusy(true)
    try {
      const result = await api.backup.import()
      if (result.ok) {
        toast('Backup restored successfully')
        setTimeout(() => window.location.reload(), 500)
      } else if (!result.cancelled) {
        toast(result.error || 'Restore failed', 'error')
      }
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBackupBusy(false)
    }
  }

  if (!settings) return <Spinner />

  return (
    <div className="max-w-2xl p-8">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Shop details, printer and account</p>

      {!settings.passwordChanged && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            You are still using the default password. Please change it below to keep your shop data safe.
          </p>
        </div>
      )}

      <form onSubmit={saveShop} className="mt-6 space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Shop Information (printed on slip)</h2>
        <Field label="Shop Name">
          <Input required value={shopName} onChange={(e) => setShopName(e.target.value)} />
        </Field>
        <Field label="Address">
          <Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />
        </Field>
        <Field label="Shop Phone" hint="Optional">
          <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
        </Field>
        <Field label="Shop Name (Urdu)" hint="Printed on the slip header. Leave empty to use the English name.">
          <Input dir="rtl" value={shopNameUrdu} onChange={(e) => setShopNameUrdu(e.target.value)} />
        </Field>
        <Field label="Shop Address (Urdu)" hint="Printed on the slip header. Leave empty to use the English address.">
          <Input dir="rtl" value={shopAddressUrdu} onChange={(e) => setShopAddressUrdu(e.target.value)} />
        </Field>
        <Field
          label="Printer for slips"
          hint="Silent printing is for a real paper printer. Microsoft Print to PDF and virtual printers open the print dialog instead."
        >
          <Dropdown
            value={printerName}
            options={[
              { value: '', label: 'Windows default printer' },
              ...printers.filter((p) => !isDialogOnlyPrinter(p)).map((p) => ({ value: p, label: p }))
            ]}
            onChange={(v) => setPrinterName(String(v))}
            searchable={printers.length > 6}
            selectedHint={
              printerName && isDialogOnlyPrinter(printerName)
                ? { value: printerName, label: `${printerName} (unsupported — pick another)` }
                : undefined
            }
          />
        </Field>
        <Field
          label="Ask before printing"
          hint="On: the Windows print dialog opens so you choose the printer or Save as PDF. Off: prints silently to the printer selected above (a dialog still opens for Fax, OneNote or XPS)."
        >
          <Switch checked={printDialog} onChange={setPrintDialog} disabled={busy} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>

      <form onSubmit={changePassword} className="mt-6 space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
        <Field label="Current Password">
          <Input type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        </Field>
        <Field label="New Password" hint="Minimum 4 characters">
          <Input type="password" required minLength={4} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <Field label="Confirm New Password">
          <Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pwBusy}>
            {pwBusy ? 'Updating…' : 'Change Password'}
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Backup & Restore</h2>
        <p className="mt-1 text-sm text-slate-500">
          Keep a copy of all your customers, orders and measurements. Store the backup file anywhere on your PC —
          if your data is ever lost, restore it here.
        </p>
        <div className="mt-4 flex gap-3">
          <Button onClick={doBackup} disabled={backupBusy}>
            <Download size={16} /> {backupBusy ? 'Working…' : 'Backup Data'}
          </Button>
          <Button variant="secondary" onClick={() => setRestoreConfirm(true)} disabled={backupBusy}>
            <Upload size={16} /> Restore from Backup
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={restoreConfirm}
        title="Restore from backup"
        message="This will replace ALL current data (customers, measurements, orders and settings) with the chosen backup file. This cannot be undone. Continue?"
        confirmLabel="Restore"
        onConfirm={doRestore}
        onCancel={() => setRestoreConfirm(false)}
      />
    </div>
  )
}
