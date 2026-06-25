export interface PolicySection {
  title: string;
  content: string;
  bullets?: string[];
}

export const termsAndConditionsContent: PolicySection[] = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing and using the Haajari App, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.",
  },
  {
    title: "2. Use License",
    content:
      "Permission is granted to temporarily download one copy of the materials on the Haajari App for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:",
    bullets: [
      "Modify or copy the materials",
      "Use the materials for any commercial purpose or for any public display",
      "Attempt to decompile or reverse engineer any software contained on the app",
      "Remove any copyright or other proprietary notations from the materials",
      "Transfer the materials to another person or 'mirror' the materials on any other server",
    ],
  },
  {
    title: "3. Disclaimer",
    content:
      "The materials on the Haajari App are provided on an 'as is' basis. The Haajari App makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.",
  },
  {
    title: "4. Limitations",
    content:
      "In no event shall the Haajari App or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on the Haajari App.",
  },
  {
    title: "5. Accuracy of Materials",
    content:
      "The materials appearing on the Haajari App could include technical, typographical, or photographic errors. The Haajari App does not warrant that any of the materials on the app are accurate, complete, or current. The Haajari App may make changes to the materials contained on the app at any time without notice.",
  },
  {
    title: "6. Materials on Other Sites",
    content:
      "The Haajari App has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by the Haajari App of the site. Use of any such linked website is at the user's own risk.",
  },
  {
    title: "7. Modifications",
    content:
      "The Haajari App may revise these terms of service for the app at any time without notice. By using this app, you are agreeing to be bound by the then current version of these terms of service.",
  },
  {
    title: "8. Governing Law",
    content:
      "These terms and conditions are governed by and construed in accordance with the laws of India, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.",
  },
  {
    title: "9. User Responsibilities",
    content:
      "Users are responsible for maintaining the confidentiality of their login information and for all activities that occur under their account. Users agree to accept responsibility for all activities that occur under their account and agree to inform the Haajari App immediately of any unauthorized use of their account.",
  },
  {
    title: "10. Data Privacy",
    content:
      "Your use of the Haajari App is also governed by our Privacy Policy. Please review the Privacy Policy to understand our practices.",
  },
];
