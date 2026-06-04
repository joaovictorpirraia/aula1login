export const dynamic = 'force-dynamic'

import { PageHeader } from '../components/PageHeader'
import { ClientesClient } from './ClientesClient'
import { getClients } from './queries'

export default async function ClientesPage() {
  const clients = await getClients()
  return (
    <div>
      <PageHeader title="Clientes" />
      <div className="px-6 py-6">
        <ClientesClient initialClients={clients} />
      </div>
    </div>
  )
}
