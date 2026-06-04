export const dynamic = 'force-dynamic'

import { PageHeader } from '../components/PageHeader'
import { PipelineClient } from './PipelineClient'
import { getDealsWithClients } from '../shared/queries'

export default async function PipelinePage() {
  const deals = await getDealsWithClients()
  return (
    <div>
      <PageHeader title="Pipeline" />
      <div className="px-6 py-6">
        <PipelineClient deals={deals} />
      </div>
    </div>
  )
}
