interface PageHeaderProps {
  title: string
  action?: React.ReactNode
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      {action}
    </div>
  )
}
