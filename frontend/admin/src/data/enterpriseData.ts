export const kpiCards = [
  { label: 'Total Organizations', value: '184', delta: '+12.4%', tone: 'positive', detail: 'Across 6 active regions' },
  { label: 'Total Workers', value: '2,840', delta: '+8.1%', tone: 'positive', detail: 'Daily attendance synced' },
  { label: 'Present Today', value: '2,312', delta: '+6.3%', tone: 'positive', detail: '91.4% attendance rate' },
  { label: 'Pending Payments', value: '₹3.4M', delta: '-2.1%', tone: 'neutral', detail: '4 invoices due this week' },
];

export const attendanceSeries = [
  { name: 'Mon', present: 82, absent: 11 },
  { name: 'Tue', present: 86, absent: 9 },
  { name: 'Wed', present: 89, absent: 8 },
  { name: 'Thu', present: 91, absent: 7 },
  { name: 'Fri', present: 94, absent: 5 },
  { name: 'Sat', present: 87, absent: 10 },
];

export const revenueSeries = [
  { month: 'Jan', revenue: 1800000 },
  { month: 'Feb', revenue: 2120000 },
  { month: 'Mar', revenue: 2380000 },
  { month: 'Apr', revenue: 2640000 },
  { month: 'May', revenue: 2980000 },
  { month: 'Jun', revenue: 3260000 },
];

export const subscriptionsBreakdown = [
  { name: 'Enterprise', value: 64, color: '#f97316' },
  { name: 'Premium', value: 41, color: '#8b5cf6' },
  { name: 'Growth', value: 28, color: '#0ea5e9' },
  { name: 'Starter', value: 19, color: '#22c55e' },
];

export const activityFeed = [
  { title: 'Attendance synced', detail: 'Northstar Tower • 144 workers marked present', time: '2 min ago', tone: 'success' },
  { title: 'Payment posted', detail: 'Apex Builders • ₹1,24,000 salary batch cleared', time: '11 min ago', tone: 'info' },
  { title: 'Worker added', detail: 'Kiran Rao onboarded to Riverfront Site', time: '28 min ago', tone: 'warning' },
  { title: 'Site milestone', detail: 'Greenline Plaza reached 78% completion', time: '44 min ago', tone: 'success' },
];

export const userRows = [
  { name: 'Aisha Khan', role: 'Operations Lead', organization: 'Northstar Infra', status: 'Active', lastLogin: '2h ago', device: 'iPhone 15' },
  { name: 'Rohit Malik', role: 'Finance Head', organization: 'Apex Builders', status: 'Pending', lastLogin: '1d ago', device: 'Windows' },
  { name: 'Meera Nair', role: 'Site Admin', organization: 'BluePeak', status: 'Active', lastLogin: '3h ago', device: 'Android' },
];

export const workerRows = [
  { name: 'Suresh Bhatia', trade: 'Civil Supervisor', site: 'Northstar Tower', status: 'Present', attendance: 'On Time' },
  { name: 'Naveen Das', trade: 'Electrician', site: 'Riverfront', status: 'Half Day', attendance: 'Late In' },
  { name: 'Priya Sharma', trade: 'Painter', site: 'Greenline Plaza', status: 'Absent', attendance: 'Leave' },
];

export const siteRows = [
  { name: 'Northstar Tower', progress: 82, supervisors: 4, workers: 124, status: 'On Track' },
  { name: 'Riverfront Residence', progress: 64, supervisors: 3, workers: 94, status: 'Watch' },
  { name: 'Greenline Plaza', progress: 91, supervisors: 5, workers: 168, status: 'Ahead' },
];

export const paymentRows = [
  { reference: 'SAL-2048', client: 'Northstar Infra', amount: '₹1,24,000', status: 'Scheduled', due: 'Today' },
  { reference: 'ADV-118', client: 'Apex Builders', amount: '₹48,500', status: 'Pending', due: '2d' },
  { reference: 'INV-772', client: 'BluePeak', amount: '₹96,200', status: 'Paid', due: 'Completed' },
];

export const reportCards = [
  { title: 'Attendance Report', description: 'Daily and monthly attendance summaries', tag: 'Live' },
  { title: 'Worker Report', description: 'Skill mix, payroll and shift patterns', tag: 'Updated' },
  { title: 'Site Report', description: 'Milestones, safety and budget health', tag: 'Exportable' },
];

export const supportTickets = [
  { title: 'Integration issue', owner: 'Asha', priority: 'High' },
  { title: 'Payroll export delay', owner: 'Nikhil', priority: 'Medium' },
  { title: 'Password reset request', owner: 'Mina', priority: 'Low' },
];

export const activityLogRows = [
  { action: 'Login', actor: 'Aisha Khan', time: '08:12', location: 'Mumbai HQ' },
  { action: 'Create Site', actor: 'Rohit Malik', time: '09:36', location: 'Delhi Office' },
  { action: 'Attendance Update', actor: 'Meera Nair', time: '11:02', location: 'Pune Site' },
];

export const settingsSections = [
  { title: 'Company profile', detail: 'Brand, legal name and operational contacts' },
  { title: 'Notifications', detail: 'Alerts for payments, attendance and site milestones' },
  { title: 'Security', detail: 'JWT expiry, session limits and device approvals' },
];
