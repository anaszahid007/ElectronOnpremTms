import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import type { Customer, Measurement, Order, ShopSettings } from '@shared/types'
import { MEASUREMENT_SECTIONS, SLIP_LEFT_FIELDS, SLIP_RIGHT_FIELDS } from '@shared/measurementFields'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/format'

export function SlipPrint() {
  const { customerId } = useParams()
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const slipNumber = Number(params.get('slip') ?? '0')
  const orderIdParam = Number(params.get('order') ?? '0') || 0

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [measurement, setMeasurement] = useState<Measurement | null>(null)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    const id = Number(customerId)
    Promise.all([
      api.customers.get(id),
      api.measurements.get(id),
      api.settings.get(),
      orderIdParam ? api.orders.get(orderIdParam) : Promise.resolve(null)
    ]).then(([c, m, s, o]) => {
      setCustomer(c)
      setMeasurement(m)
      setSettings(s)
      setOrder(o)
    })
  }, [customerId, orderIdParam])

  useEffect(() => {
    if (!customer || !measurement || !settings || (orderIdParam && !order)) return
    document.fonts.ready.then(async () => {
      await new Promise((r) => setTimeout(r, 150))
      api.print.slipReady(slipNumber)
    })
  }, [customer, measurement, settings, order, orderIdParam, slipNumber])

  if (!customer || !measurement || !settings) return null

  const now = new Date()
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const shopNameUrdu = settings.shopNameUrdu || settings.shopName
  const shopAddressUrdu = settings.shopAddressUrdu || settings.shopAddress

  return (
    <div className="slip-page">
      {/* Header */}
      <div className="flex items-start justify-between border-b-4 border-double border-black pb-3">
        <div className="w-56 border-2 border-black">
          <div
            className="slip-urdu border-b border-black px-4 py-1.5 text-right text-lg font-bold"
            style={{ direction: 'ltr' }}
          >
            Serial #{customer.serialNumber}
          </div>
          <div className="px-4 py-1.5 text-right text-sm font-semibold">
            {date} - {time}
          </div>
        </div>
        <div className="text-right">
          <h1 className="slip-urdu text-3xl font-bold">{shopNameUrdu}</h1>
          {shopAddressUrdu && <p className="slip-urdu mt-1 text-base">{shopAddressUrdu}</p>}
        </div>
      </div>

      {/* Customer box */}
      <div className="mt-3 border-2 border-black">
        <table className="w-full">
          <tbody>
            <tr className="border-b border-black">
              <td className="px-4 py-2 text-xl font-bold">{customer.fullName}</td>
              <td className="slip-urdu w-44 border-l-2 border-black bg-gray-100 px-4 py-2 text-right text-lg font-bold">
                گاہک کا نام
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-xl font-bold">{customer.phone}</td>
              <td className="slip-urdu w-44 border-l-2 border-black bg-gray-100 px-4 py-2 text-right text-lg font-bold">
                ٹیلیفون
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Measurements */}
      <div className="slip-urdu mt-3 border-2 border-black bg-gray-50  py-1.5 text-center text-xl font-bold text-white">
        {MEASUREMENT_SECTIONS[0].urduTitle}
      </div>

      <table className="mt-2 w-full border-collapse text-left">
        <tbody>
          <tr className="align-top">
            <td className="w-1/2 border border-black p-0">
              <table className="w-full border-collapse">
                <tbody>
                  {/* Customer serial number — first row */}
                  <tr>
                    <td className="w-1/2 border-b border-black px-3 py-1 text-lg font-bold">
                      {customer.serialNumber}
                    </td>
                    <td className="slip-urdu w-1/2 border-b border-l border-black bg-gray-50 px-3 py-1 text-right text-lg font-bold">
                      سریل نمبر
                    </td>
                  </tr>
                  {SLIP_LEFT_FIELDS.map((f) => (
                    <tr key={f.key}>
                      <td className="w-1/2 border-b border-black px-3 py-1 text-lg font-bold">
                        {measurement.values[f.key] ?? ''}
                      </td>
                      <td className="slip-urdu w-1/2 border-b border-l border-black bg-gray-50 px-3 py-1 text-right text-lg font-bold">
                        {f.urdu}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="w-1/2 border-b border-black px-3 py-1 text-lg font-bold">
                      {order ? formatMoney(order.totalAmount) : ''}
                    </td>
                    <td className="slip-urdu w-1/2 border-b border-l border-black bg-gray-50 px-3 py-1 text-right text-lg font-bold">
                      کل رقم
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/2 border-b border-black px-3 py-1 text-lg font-bold">
                      {order ? formatMoney(order.advancePaid) : ''}
                    </td>
                    <td className="slip-urdu w-1/2 border-b border-l border-black bg-gray-50 px-3 py-1 text-right text-lg font-bold">
                      ایڈوانس
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/2 border-b border-black px-3 py-1 text-lg font-bold">
                      {order ? formatMoney(order.balance) : ''}
                    </td>
                    <td className="slip-urdu w-1/2 border-b border-l border-black bg-gray-50 px-3 py-1 text-right text-lg font-bold">
                      بقایا رقم
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td className="w-1/2 border border-black p-0">
              <table className="w-full border-collapse">
                <tbody>
                  {SLIP_RIGHT_FIELDS.map((f) => (
                    <tr key={f.key}>
                      <td className="w-1/2 border-b border-black px-3 py-1 text-lg font-bold">
                        {measurement.values[f.key] ?? ''}
                      </td>
                      <td className="slip-urdu w-1/2 border-b border-l border-black bg-gray-50 px-3 py-1 text-right text-lg font-bold">
                        {f.urdu}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="w-1/2 border-b border-black px-3 py-1 text-lg font-bold">
                      {order ? order.quantity : ''}
                    </td>
                    <td className="slip-urdu w-1/2 border-b border-l border-black bg-gray-50 px-3 py-1 text-right text-lg font-bold">
                      تعداد جوڑے
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
