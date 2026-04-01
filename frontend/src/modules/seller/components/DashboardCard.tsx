import { ReactNode } from 'react';

interface DashboardCardProps {
  icon: ReactNode;
  title: string;
  value: number | string;
  accentColor: string;
}

export default function DashboardCard({ icon, title, value, accentColor }: DashboardCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4 hover:shadow-md transition-shadow duration-200">
      <div className="mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
          <div style={{ color: accentColor }} className="w-6 h-6">{icon}</div>
        </div>
      </div>
      <h3 className="text-neutral-500 text-xs font-medium mb-0.5">{title}</h3>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}
