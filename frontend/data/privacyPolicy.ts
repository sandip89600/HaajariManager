import { PolicySection } from "./termsAndConditions";

export const privacyPolicyContent: PolicySection[] = [
  {
    title: "1. Information We Collect",
    content:
      "We collect information you provide directly to us when you create an account, manage workers, mark attendance, or communicate with us. This includes:",
    bullets: [
      "Personal information: Name, phone number, email address, physical address, organization details.",
      "Workforce data: Workers' names, phone numbers, categories, daily wage rates, notes, and photos.",
      "Attendance records: Logs of daily presence, absence, half-days, custom payout rates, and GPS coordinates (if enabled).",
      "Transaction info: Payment histories, transaction notes, and plan subscriptions.",
    ],
  },
  {
    title: "2. How We Use Your Information",
    content:
      "We use the collected information for various purposes to deliver and improve our workforce management platform, including to:",
    bullets: [
      "Provide, maintain, and secure the Haajari workforce management platform.",
      "Sync local offline mobile data with the Cloud MongoDB database.",
      "Generate payroll, summaries, analytics, and metrics reports.",
      "Process subscription plans, upgrades, and support requests.",
      "Communicate security alerts, updates, and customer support notifications.",
    ],
  },
  {
    title: "3. Location Data & GPS Tracking",
    content:
      "The Haajari App provides optional GPS-based attendance marking for Pro and Business plan users. Location coordinates are collected solely when marking attendance to verify site presence and are never shared or tracked in the background.",
  },
  {
    title: "4. Information Sharing & Disclosure",
    content:
      "We do not sell, trade, or rent your personal or workforce database information to third parties. We may disclose data only to comply with legal obligations, enforce our policies, or protect rights, property, or safety.",
  },
  {
    title: "5. Data Security",
    content:
      "We implement robust administrative and technical security measures (including JWT session tokens, encrypted databases, and secure uploads) to safeguard your data. However, no transmission over the internet or cloud storage can be guaranteed 100% secure.",
  },
  {
    title: "6. Data Retention & Deletion",
    content:
      "You can update or delete your profile information at any time. When you use the 'Delete Account' button inside your Profile screen, it triggers a cascading deletion that permanently deletes all your associated workers, attendance registries, payroll records, and supervisor structures from our MongoDB database.",
  },
  {
    title: "7. Cookies & Web Tracking",
    content:
      "Our web dashboard and portal may use essential cookies to manage authenticated session tokens and maintain admin preferences.",
  },
  {
    title: "8. Changes to this Privacy Policy",
    content:
      "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the version number.",
  },
  {
    title: "9. Contact Us",
    content:
      "If you have any questions or suggestions regarding our Privacy Policy, please contact our support team at info.haajariapp@gmail.com.",
  },
];
