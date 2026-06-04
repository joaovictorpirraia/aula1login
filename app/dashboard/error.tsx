'use client'

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-lg font-semibold text-gray-800">
          Erro ao carregar o dashboard
        </h2>
        <p className="text-sm text-gray-500">
          Não foi possível buscar os dados. Tente novamente.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
