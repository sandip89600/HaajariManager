import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PageShellProps {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}

export function PageShell({ title, description, children, action }: PageShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}
