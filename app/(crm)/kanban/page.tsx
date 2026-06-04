export const dynamic = 'force-dynamic'

import { PageHeader } from '../components/PageHeader'
import { KanbanClient } from './KanbanClient'
import { getDealsWithClients } from '../shared/queries'
import { getClients } from '../clientes/queries'

export default async function KanbanPage() {
  const [deals, clients] = await Promise.all([getDealsWithClients(), getClients()])
  return (
    <div>
      <PageHeader title="Kanban" />
      <div className="px-6 py-6">
        <KanbanClient deals={deals} clients={clients} />
      </div>
    </div>
  )
}
